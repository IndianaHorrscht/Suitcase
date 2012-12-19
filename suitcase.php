<?php
    class Suitcase
    {
        /**
        * Members
        */
        private $jscode="";
        private $allowedcallables=array
        (
            'time', 'date', 'mktime', 'strftime', 'strtotime', 'easter_date', 'easter_days',
            'htmlspecialchars', 'htmlspecialchars_decode', 'htmlentities', 'html_entity_decode', 'strip_tags',
            'base64_decode', 'base64_encode', 'pack', 'unpack'
        );

        /**
        * Constructor
        *
        * @param string $jscode JavaScript to be run on the client in case this Suitcase is used as result object
        */
        public function __construct($jscode='')
        {
            $this->jscode=$jscode;
        }

        /**
        * Create new instance for fluent use
        *
        * @return Suitcase
        */
        public static function getInstance()
        {
            return new self;
        }

        /**
        * Add JavaScript code
        *
        * @param $jscode
        * @return Suitcase
        */
        public function addCode($jscode)
        {
            $this->jscode.=$jscode;
            return $this;
        }

        /**
        * Add JavaScript function call via magic function
        */
        public function __call($cmd, $params)
        {
            if ($this->getCode() && substr(trim($this->getCode()), -1, 1)!=';') $this->addCode('.');
            $this->addCode($cmd);
            $this->addCode('('.substr(json_encode($params), 1, -1).')');
            return $this;
        }

        /**
        * Add JavaScript property read via magic function
        */
        public function __get($name)
        {
            if ($this->getCode() && substr(trim($this->getCode()), -1, 1)!=';') $this->addCode('.');
            $this->addCode($name);
            return $this;
        }

        /**
        * Add JavaScript property write via magic function
        */
        public function __set($name, $value)
        {
            $this->__get($name);
            $this->assign($value);
            return $this;
        }

        /**
        * Assign JavaScript value
        *
        * @param mixed $value
        * @return Suitcase
        */
        public function assign($value)
        {
            $this->addCode('='.json_encode($value).';');
            return $this;
        }

        /**
        * End JavaScript code chain
        *
        * @return Suitcase
        */
        public function end()
        {
            $this->addCode(';');
            return $this;
        }

        /**
        * Get JavaScript code
        *
        * @return string
        */
        public function getCode()
        {
            return $this->jscode;
        }

        /**
        * Dispatch an incoming call from JavaScript
        */
        public function dispatch()
        {
            // Send UTF-8 header
            if (!@headers_sent()) @header('Content-Type: application/json; charset=utf-8', true);

            // Parse parameters
            $callable=(string)$_POST['callable'];
            $params=json_decode($_POST['params']);
            $fields=json_decode($_POST['fields']);
            $getters=json_decode($_POST['getters']);

            // Prepare getter key names
            foreach($getters as $index => $triple)
                $getters[$index]->key=(isset($triple->key) && $triple->key!="")?$triple->key:strtolower(substr($triple->name, 0, 3)=='get'?substr($triple->name, 3):$triple->name);

            // Test if callable is allowed
            if (!$this->isAllowedCallable($callable)) die(json_encode(array('errortext' => 'Suitcase: Callable "'.$callable.'" is not allowed')));

            // Call callable
            $result=call_user_func_array($callable, $params);

            // Check for executable Suitcase result
            if ($result instanceof Suitcase) die(json_encode(array('jscode' => $result->getCode())));

            // Return non-executable result
            $result=$this->parseResult($result, $fields, $getters);
            die(json_encode(array('result' => $result), JSON_FORCE_OBJECT));
        }

        /**
        * Parse result into JavaScript representation
        */
        private function parseResult($result, $fields, $getters)
        {
            // Array of objects
            if (is_array($result))
            {
                foreach($result as $key => $value) $result[$key]=$this->parseResult($value, $fields, $getters);
                return $result;
            }

            // Single object
            if (is_object($result))
            {
                // Return all public fields if no specific fields or getters are requested
                $vars=get_object_vars($result);
                if (!$fields && !$getters) $fields=array_keys($vars);

                // Run through fields and getters
                $parsed=array();
                foreach ($fields as $key) $parsed[$key]=$vars[$key];
                foreach ($getters as $triple) $parsed[$triple->key]=call_user_func_array(array($result, $triple->name), $triple->params);
                return $parsed;
            }

            // Not parsable
            return $result;
        }

        /**
        * Add allowed callable to list
        *
        * @param string $callable
        * @return Suitcase
        */
        public function addAllowedCallable($callable)
        {
            if (is_string($callable)) $this->allowedcallables[]=strtolower($callable);
            return $this;
        }

        /**
        * Find out if a particular function is allowed to be called
        *
        * @param string $callable Function name
        * @return bool
        */
        private function isAllowedCallable($callable)
        {
            // Check list
            if (!is_string($callable)) return false;
            $callable=strtolower($callable);
            if (in_array($callable, $this->allowedcallables)) return true;

            // Check "@internal Suitcase" annotation
            if (count($parts=explode('::', $callable))==2)
            {
                try { $class=new ReflectionClass($parts[0]); $method=$class->getMethod($parts[1]); } catch (Exception $e) { return false; }
                if (preg_match('~@internal.+Suitcase~i', $method->getDocComment())) return true;
            }
            return false;
        }
    }
?>
