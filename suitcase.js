/**
* Suitcase: Simplify Ajax communication with PHP functions
*
* @param {string} dispatcher Dispatcher URL
*/
var Suitcase=function(dispatcher)
{
    /**
    * Private members
    */
    var p_dispatcher, p_fields=[], p_getters=[];

    /**
    * Set dispatcher URL
    *
    * @param {string} dispatcher URL
    * @returns {Suitcase}
    */
    this.setDispatcher=function (dispatcher)
    {
        p_dispatcher=dispatcher;
        return this;
    };

    /**
    * Add field to be fetched from result
    *
    * @param {string} key
    * @returns {Suitcase}
    */
    this.addField=function (key)
    {
        p_fields.push(key);
        return this;
    };

    /**
    * Add getter function to be called on result
    *
    * @param {String} name Function name
    * @param {Array} params Optional parameter or array of parameters
    * @param {String} key Optional key with which the result value will be stored
    * @returns {Suitcase}
    */
    this.addGetter=function (name, params, key)
    {
        if (params===undefined) params=[]; else if (Object.prototype.toString.call(params)!=="[object Array]") params=[params];
        p_getters.push({ name: name, params: params, key: key });
        return this;
    };

    /**
    * Call server function
    *
    * @param {String} callable Function or method to call on server
    * @param {Array} params Optional parameter or array of parameters
    * @param {Function} callback Optional callback
    * @returns {XMLHttpRequest}
    */
    this.call=function(callable, params, callback)
    {
        // Preparations
        var fields, getters;
        // Prepare parameters, fields and getters
        if (params===undefined) params=[]; else if (Object.prototype.toString.call(params)!=="[object Array]") params=[params];
        params=stringify(params);
        fields=stringify(p_fields);
        getters=stringify(p_getters);

        // Parse response
        function parseresponse(xhr)
        {
            var response={};
            if (xhr.status==200)
            {
                try { response=parse(xhr.responseText); } catch (e) { throw "Suitcase: Malformed response, "+e.message+", payload: "+xhr.responseText; }
                if (response.errortext) throw response.errortext;
            }
            if (response.jscode) try { (new Function(response.jscode))(); } catch (e) { throw "Suitcase: Response execution failed, "+e.message+", payload: "+response.jscode; }
            if (callback) callback(response.result, xhr);
        }

        // Make the call
        return ajax(p_dispatcher?p_dispatcher:"/", "POST", { callable: callable, params: params, fields: fields, getters: getters }, parseresponse);
    };

    /**
    * Send Ajax request to server
    *
    * @param {String} url URL
    * @param {String} method GET or POST
    * @param {Object} data Key value pairs or raw post data
    * @param {Function} callback Optional callback, if this is not given the call will be blocking
    * @returns {XMLHttpRequest}
    * @private
    */
    function ajax(url, method, data, callback)
    {
        // Create request object
        var xhr, partial=[], payload="";
        try { xhr=new XMLHttpRequest(); } catch (e) { try { xhr=new ActiveXObject("Microsoft.XMLHTTP"); } catch (e) { } }
        if (!xhr) throw "Suitcase: No XML HTTP request object available";

        // Prepare payload
        if (typeof(data)!="object") payload=data; else
        {
            for (var k in data) if (data.hasOwnProperty(k)) partial.push(encodeURIComponent(k)+'='+encodeURIComponent(data[k]));
            if (method.toUpperCase()=="POST") payload=partial.join("&"); else url+=(url.indexOf("?")>=0?"&":"?")+partial.join("&");
        }

        // Make the call
        xhr.open(method, url, true);
        if (callback) xhr.onreadystatechange=function() { if (xhr.readyState==4) callback(xhr); };
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.send(payload);
        return xhr;
    };

    /**
    * Call server with GET
    *
    * @param {String} url URL or relative path
    * @param {Object} params Optional key value pairs to add to the URL
    * @param {Function} callback Optional callback
    * @returns {XMLHttpRequest}
    */
    this.get=function (url, params, callback)
    {
        return ajax(url, "GET", params, callback?function(xhr) { callback(xhr.responseText, xhr); }:null);
    };

    /**
    * Call server with POST
    *
    * @param {String} url URL or relative path
    * @param {Object} params Optional key value pairs to post or raw post data
    * @param {Function} callback Optional callback
    * @returns {XMLHttpRequest}
    */
    this.post=function (url, params, callback)
    {
        return ajax(url, "POST", params, callback?function(xhr) { callback(xhr.responseText, xhr); }:null);
    };

    /**
    * Parse JSON string to native JavaScript value (taken from jQuery)
    *
    * @param {String}
    * @returns {Object}
    * @private
    */
    function parse(data)
    {
        if (typeof(JSON)!=="undefined" && JSON.parse) return JSON.parse(data);
        return (new Function("return "+data))();
    };

    /**
    * Convert a native JavaScript value to JSON string (taken from Crockford's JSON2)
    *
    * @param {Object}
    * @param {String}
    * @private
    */
    function stringify(value)
    {
        if (typeof(JSON)!=="undefined" && JSON.stringify) return JSON.stringify(value);
        switch (typeof value)
        {
            case 'null': case 'boolean': return String(value);
            case 'string': return quote(value);
            case 'number': return isFinite(value)?String(value):'null';
            case 'object':
                var partial=[];
                if (!value) return 'null';
                if (Object.prototype.toString.apply(value)==='[object Array]')
                {
                    for (var i=0; i<value.length; i++) partial[i]=stringify(value[i]);
                    return "["+partial.join(",")+"]";
                }
                for (var k in value) if (Object.prototype.hasOwnProperty.call(value, k)) partial.push(quote(k)+':'+stringify(value[k]));
                return "{"+partial.join(",")+"}";
            default: return 'null';
        }
    };

    /**
    * Quote a string to be compatible with JSON (taken from Crockford's JSON2)
    *
    * @param {String}
    * @returns {String}
    * @private
    */
    function quote(string)
    {
        this.jsonescapable.lastIndex=0;
        return this.jsonescapable.test(string) ? '"'+string.replace(this.quote.jsonescapable, function(a)
        {
            var c = this.jsonmeta[a];
            return typeof(c)==="string" ? c : '\\u' + ('0000'+a.charCodeAt(0).toString(16)).slice(-4);
        })+'"' : '"'+string+'"';
    };
    quote.jsonescapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    quote.jsonmeta={ '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"' : '\\"', '\\': '\\\\' };

    // Inherit global dispatcher
    if (dispatcher) p_dispatcher=dispatcher; else p_dispatcher=Suitcase.dispatcher;
};

/**
* Set global dispatcher
*
* @param {String} dispatcher  Dispatcher URL
* @static
*/
Suitcase.setDispatcher=function(dispatcher)
{
    Suitcase.dispatcher=dispatcher;
};

/**
* Create instance for fluent use
*
* @returns {Suitcase}
* @static
*/
Suitcase.getInstance=function ()
{
    return new Suitcase();
};

/**
* Call server function
*
* @param {String} callable Function or method to call on server
* @param {Array} params Optional parameter or array of parameters
* @param {Function} callback Optional callback
* @returns {XMLHttpRequest}
*/
Suitcase.call=function(callable, params, callback)
{
    return Suitcase.getInstance().call(callable, params, callback);
};

/**
* Call server with GET
*
* @param {String} url URL or relative path
* @param {Object} params Optional key value pairs to add to the URL
* @param {Function} callback Optional callback
* @returns {XMLHttpRequest}
* @static
*/
Suitcase.get=function (url, params, callback)
{
    return Suitcase.getInstance().get(url, params, callback);
};

/**
* Call server with POST
*
* @param {String} url URL or relative path
* @param {Object} params Optional key value pairs to post or raw post data
* @param {Function} callback Optional callback
* @returns {XMLHttpRequest}
* @static
*/
Suitcase.post=function (url, params, callback)
{
    return Suitcase.getInstance().post(url, params, callback);
};
