define(function(require, exports, module) {
    
/**
 * When an EventEmitter instance experiences an error, the typical action is to
 * emit an 'error' event. Error events are treated as a special case. If there
 * is no listener for it, then the default action is for the error to throw.
 *
 * All EventEmitters emit the event 'newListener' when new listeners are added.
 *
 * @name events.EventEmitter
 * @api public
 *
 * ```javascript
 *
 * // create an event emitter
 * var emitter = new EventEmitter();
 * ```
 */

var EventEmitter = exports.EventEmitter = function() {};

var toString = Object.prototype.toString;

var isArray = Array.isArray || function(obj) {
    return toString.call(obj) === '[object Array]';
};

/**
 * By default EventEmitters will print a warning if more than 10 listeners are
 * added for a particular event. This is a useful default which helps finding
 * memory leaks. Obviously not all Emitters should be limited to 10. This
 * function allows that to be increased. Set to zero for unlimited.
 *
 * @name emitter.setMaxListeners(n)
 * @param {Number} n - The maximum number of listeners
 * @api public
 */

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
    if (!this._events) this._events = {};
    this._events.maxListeners = n;
};


/**
 * Execute each of the listeners in order with the supplied arguments.
 *
 * @name emitter.emit(event, [arg1], [arg2], [...])
 * @param {String} event - The event name/id to fire
 * @api public
 */
EventEmitter.prototype.emit = function(type) {
    if (!this._events) 
        return;

    var handler = this._events[type];
    if (!handler) 
        return;
    
    var returnValue;

    if (typeof handler == 'function') {
        switch (arguments.length) {
            // fast cases
        case 1:
            return handler.call(this);
        case 2:
            return handler.call(this, arguments[1]);
        case 3:
            return handler.call(this, arguments[1], arguments[2]);
            // slower
        default:
            var args = Array.prototype.slice.call(arguments, 1);
            returnValue = handler.apply(this, args);
        }
    }
    else if (isArray(handler)) {
        var args = Array.prototype.slice.call(arguments, 1);

        var listeners = handler.slice(), temp;
        for (var i = 0, l = listeners.length; i < l; i++) {
            temp = listeners[i].apply(this, args);
            if (temp !== undefined) 
                returnValue = temp;
        }
    }
    
    return returnValue;
};


/**
 * Adds a listener to the end of the listeners array for the specified event.
 *
 * @name emitter.on(event, listener) | emitter.addListener(event, listener)
 * @param {String} event - The event name/id to listen for
 * @param {Function} listener - The function to bind to the event
 * @api public
 *
 * ```javascript
 * session.on('change', function (userCtx) {
 *     console.log('session changed!');
 * });
 * ```
 */

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener, plugin) {
    if ('function' !== typeof listener) {
        throw new Error('addListener only takes instances of Function');
    }

    if (!this._events) this._events = {};

    var eventList = this._events[type];

    if (!eventList) {
        // Optimize the case of one listener. Don't need the extra array object.
        this._events[type] = listener;
    }
    else if (isArray(eventList)) {
         // if (eventList.indexOf(listener) != -1)
         //   return console.warn("adding same listener twice", type)


        // Check for listener leak
        if (!eventList.warned) {
            var m;
            if (this._events.maxListeners !== undefined) {
                m = this._events.maxListeners;
            }
            else {
                m = defaultMaxListeners;
            }

            if (m && m > 0 && eventList.length > m) {
                eventList.warned = true;
                console.error('warning: possible EventEmitter memory '
                    + 'leak detected. " + eventList.length + " listeners of type "' + type + '" added. '
                    + 'Use emitter.setMaxListeners() to increase limit.'
                );
                console.trace();
            }
        }

        // If we've already got an array, just append.
        eventList.push(listener);
    }
    else {
        // if (eventList == listener) 
        //     return console.warn("adding same listener twice", type);
        // Adding the second element, need to change to array.
        this._events[type] = [eventList, listener];
    }
    
    if (type != "newListener") 
        this.emit('newListener', type, listener);
    
    plugin && plugin.addEvent(this, type, listener);

    return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

/**
 * Adds a one time listener for the event. This listener is invoked only the
 * next time the event is fired, after which it is removed.
 *
 * @name emitter.once(event, listener)
 * @param {String} event- The event name/id to listen for
 * @param {Function} listener - The function to bind to the event
 * @api public
 *
 * ```javascript
 * db.once('unauthorized', function (req) {
 *     // this event listener will fire once, then be unbound
 * });
 * ```
 */

EventEmitter.prototype.once = function(type, listener, plugin) {
    var self = this;
    
    var wrapped = function() {
        self.removeListener(type, listener);
        return listener.apply(self, arguments);
    }
    wrapped.listener = listener;
    
    self.on(type, wrapped, plugin);

    return this;
};

/**
 * Remove a listener from the listener array for the specified event. Caution:
 * changes array indices in the listener array behind the listener.
 *
 * @name emitter.removeListener(event, listener)
 * @param {String} event - The event name/id to remove the listener from
 * @param {Function} listener - The listener function to remove
 * @api public
 *
 * ```javascript
 * var callback = function (init) {
 *     console.log('duality app loaded');
 * };
 * devents.on('init', callback);
 * // ...
 * devents.removeListener('init', callback);
 * ```
 */

EventEmitter.prototype.removeListener = function(type, listener) {
    if ('function' !== typeof listener) {
        throw new Error('removeListener only takes instances of Function');
    }

    // does not use listeners(), so no side effect of creating _events[type]
    if (!this._events || !this._events[type]) return this;

    var list = this._events[type];

    if (isArray(list)) {
        if (!list.some(function(l, i){
            if ((l.listener || l) == listener) {
                list.splice(i, 1);
                return true;
            }
        })) return this;
        
        if (list.length === 0) 
            delete this._events[type];
    }
    else if ((this._events[type].listener || this._events[type]) === listener) {
        delete this._events[type];
    }
    
    if (type != "removeListener")
        this.emit('removeListener', type, listener);

    return this;
};

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

/**
 * Removes all listeners, or those of the specified event.
 *
 * @name emitter.removeAllListeners([event])
 * @param {String} event - Event name/id to remove all listeners for (optional)
 * @api public
 */

EventEmitter.prototype.removeAllListeners = function(type) {
    // does not use listeners(), so no side effect of creating _events[type]
    if (type && this._events && this._events[type]) this._events[type] = null;
    return this;
};

/**
 * Returns an array of listeners for the specified event. This array can be
 * manipulated, e.g. to remove listeners.
 *
 * @name emitter.listeners(event)
 * @param {String} events - The event name/id to return listeners for
 * @api public
 *
 * ```javascript
 * session.on('change', function (stream) {
 *     console.log('session changed');
 * });
 * console.log(util.inspect(session.listeners('change'))); // [ [Function] ]
 * ```
 */

EventEmitter.prototype.listeners = function(type) {
    if (!this._events) this._events = {};
    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
        this._events[type] = [this._events[type]];
    }
    return this._events[type];
};


/**
 * @name emitter Event: 'newListener'
 *
 * This event is emitted any time someone adds a new listener.
 *
 * ```javascript
 * emitter.on('newListener', function (event, listener) {
 *     // new listener added
 * });
 * ```
 */
 
});