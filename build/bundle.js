var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_options(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            option.selected = ~value.indexOf(option.__value);
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    function isObject(value) {
      const type = typeof value;
      return value != null && (type == 'object' || type == 'function');
    }

    function getColumnSizeClass(isXs, colWidth, colSize) {
      if (colSize === true || colSize === '') {
        return isXs ? 'col' : `col-${colWidth}`;
      } else if (colSize === 'auto') {
        return isXs ? 'col-auto' : `col-${colWidth}-auto`;
      }

      return isXs ? `col-${colSize}` : `col-${colWidth}-${colSize}`;
    }

    function toClassName(value) {
      let result = '';

      if (typeof value === 'string' || typeof value === 'number') {
        result += value;
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          result = value.map(toClassName).filter(Boolean).join(' ');
        } else {
          for (let key in value) {
            if (value[key]) {
              result && (result += ' ');
              result += key;
            }
          }
        }
      }

      return result;
    }

    function classnames(...args) {
      return args.map(toClassName).filter(Boolean).join(' ');
    }

    /* node_modules/sveltestrap/src/Button.svelte generated by Svelte v3.32.3 */

    function create_else_block_1(ctx) {
    	let button;
    	let button_aria_label_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[17].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);
    	const default_slot_or_fallback = default_slot || fallback_block(ctx);

    	let button_levels = [
    		/*$$restProps*/ ctx[9],
    		{ class: /*classes*/ ctx[7] },
    		{ disabled: /*disabled*/ ctx[2] },
    		{ value: /*value*/ ctx[5] },
    		{
    			"aria-label": button_aria_label_value = /*ariaLabel*/ ctx[6] || /*defaultAriaLabel*/ ctx[8]
    		},
    		{ style: /*style*/ ctx[4] }
    	];

    	let button_data = {};

    	for (let i = 0; i < button_levels.length; i += 1) {
    		button_data = assign(button_data, button_levels[i]);
    	}

    	return {
    		c() {
    			button = element("button");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			set_attributes(button, button_data);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler_1*/ ctx[19]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 65536) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[16], dirty, null, null);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && dirty & /*close, children, $$scope*/ 65539) {
    					default_slot_or_fallback.p(ctx, dirty);
    				}
    			}

    			set_attributes(button, button_data = get_spread_update(button_levels, [
    				dirty & /*$$restProps*/ 512 && /*$$restProps*/ ctx[9],
    				(!current || dirty & /*classes*/ 128) && { class: /*classes*/ ctx[7] },
    				(!current || dirty & /*disabled*/ 4) && { disabled: /*disabled*/ ctx[2] },
    				(!current || dirty & /*value*/ 32) && { value: /*value*/ ctx[5] },
    				(!current || dirty & /*ariaLabel, defaultAriaLabel*/ 320 && button_aria_label_value !== (button_aria_label_value = /*ariaLabel*/ ctx[6] || /*defaultAriaLabel*/ ctx[8])) && { "aria-label": button_aria_label_value },
    				(!current || dirty & /*style*/ 16) && { style: /*style*/ ctx[4] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (33:0) {#if href}
    function create_if_block(ctx) {
    	let a;
    	let current_block_type_index;
    	let if_block;
    	let a_aria_label_value;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*children*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	let a_levels = [
    		/*$$restProps*/ ctx[9],
    		{ class: /*classes*/ ctx[7] },
    		{ disabled: /*disabled*/ ctx[2] },
    		{ href: /*href*/ ctx[3] },
    		{
    			"aria-label": a_aria_label_value = /*ariaLabel*/ ctx[6] || /*defaultAriaLabel*/ ctx[8]
    		},
    		{ style: /*style*/ ctx[4] }
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	return {
    		c() {
    			a = element("a");
    			if_block.c();
    			set_attributes(a, a_data);
    		},
    		m(target, anchor) {
    			insert(target, a, anchor);
    			if_blocks[current_block_type_index].m(a, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen(a, "click", /*click_handler*/ ctx[18]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(a, null);
    			}

    			set_attributes(a, a_data = get_spread_update(a_levels, [
    				dirty & /*$$restProps*/ 512 && /*$$restProps*/ ctx[9],
    				(!current || dirty & /*classes*/ 128) && { class: /*classes*/ ctx[7] },
    				(!current || dirty & /*disabled*/ 4) && { disabled: /*disabled*/ ctx[2] },
    				(!current || dirty & /*href*/ 8) && { href: /*href*/ ctx[3] },
    				(!current || dirty & /*ariaLabel, defaultAriaLabel*/ 320 && a_aria_label_value !== (a_aria_label_value = /*ariaLabel*/ ctx[6] || /*defaultAriaLabel*/ ctx[8])) && { "aria-label": a_aria_label_value },
    				(!current || dirty & /*style*/ 16) && { style: /*style*/ ctx[4] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(a);
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (62:6) {:else}
    function create_else_block_2(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[17].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 65536) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[16], dirty, null, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    // (60:25) 
    function create_if_block_3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*children*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*children*/ 1) set_data(t, /*children*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (58:6) {#if close}
    function create_if_block_2(ctx) {
    	let span;

    	return {
    		c() {
    			span = element("span");
    			span.textContent = "×";
    			attr(span, "aria-hidden", "true");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (57:10)        
    function fallback_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2, create_if_block_3, create_else_block_2];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*close*/ ctx[1]) return 0;
    		if (/*children*/ ctx[0]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (44:4) {:else}
    function create_else_block(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[17].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 65536) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[16], dirty, null, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    // (42:4) {#if children}
    function create_if_block_1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*children*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*children*/ 1) set_data(t, /*children*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*href*/ ctx[3]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let ariaLabel;
    	let classes;
    	let defaultAriaLabel;

    	const omit_props_names = [
    		"class","active","block","children","close","color","disabled","href","outline","size","style","value"
    	];

    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { active = false } = $$props;
    	let { block = false } = $$props;
    	let { children = undefined } = $$props;
    	let { close = false } = $$props;
    	let { color = "secondary" } = $$props;
    	let { disabled = false } = $$props;
    	let { href = "" } = $$props;
    	let { outline = false } = $$props;
    	let { size = null } = $$props;
    	let { style = "" } = $$props;
    	let { value = "" } = $$props;

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	function click_handler_1(event) {
    		bubble($$self, event);
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(20, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		$$invalidate(9, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(10, className = $$new_props.class);
    		if ("active" in $$new_props) $$invalidate(11, active = $$new_props.active);
    		if ("block" in $$new_props) $$invalidate(12, block = $$new_props.block);
    		if ("children" in $$new_props) $$invalidate(0, children = $$new_props.children);
    		if ("close" in $$new_props) $$invalidate(1, close = $$new_props.close);
    		if ("color" in $$new_props) $$invalidate(13, color = $$new_props.color);
    		if ("disabled" in $$new_props) $$invalidate(2, disabled = $$new_props.disabled);
    		if ("href" in $$new_props) $$invalidate(3, href = $$new_props.href);
    		if ("outline" in $$new_props) $$invalidate(14, outline = $$new_props.outline);
    		if ("size" in $$new_props) $$invalidate(15, size = $$new_props.size);
    		if ("style" in $$new_props) $$invalidate(4, style = $$new_props.style);
    		if ("value" in $$new_props) $$invalidate(5, value = $$new_props.value);
    		if ("$$scope" in $$new_props) $$invalidate(16, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		$$invalidate(6, ariaLabel = $$props["aria-label"]);

    		if ($$self.$$.dirty & /*className, close, outline, color, size, block, active*/ 64514) {
    			$$invalidate(7, classes = classnames(className, { close }, close || "btn", close || `btn${outline ? "-outline" : ""}-${color}`, size ? `btn-${size}` : false, block ? "btn-block" : false, { active }));
    		}

    		if ($$self.$$.dirty & /*close*/ 2) {
    			$$invalidate(8, defaultAriaLabel = close ? "Close" : null);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		children,
    		close,
    		disabled,
    		href,
    		style,
    		value,
    		ariaLabel,
    		classes,
    		defaultAriaLabel,
    		$$restProps,
    		className,
    		active,
    		block,
    		color,
    		outline,
    		size,
    		$$scope,
    		slots,
    		click_handler,
    		click_handler_1
    	];
    }

    class Button extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			class: 10,
    			active: 11,
    			block: 12,
    			children: 0,
    			close: 1,
    			color: 13,
    			disabled: 2,
    			href: 3,
    			outline: 14,
    			size: 15,
    			style: 4,
    			value: 5
    		});
    	}
    }

    /* node_modules/sveltestrap/src/Card.svelte generated by Svelte v3.32.3 */

    function create_fragment$1(ctx) {
    	let div;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	let div_levels = [
    		/*$$restProps*/ ctx[2],
    		{ class: /*classes*/ ctx[1] },
    		{ style: /*style*/ ctx[0] }
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(div, "click", /*click_handler*/ ctx[10]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
    				}
    			}

    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				dirty & /*$$restProps*/ 4 && /*$$restProps*/ ctx[2],
    				(!current || dirty & /*classes*/ 2) && { class: /*classes*/ ctx[1] },
    				(!current || dirty & /*style*/ 1) && { style: /*style*/ ctx[0] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let classes;
    	const omit_props_names = ["class","body","color","inverse","outline","style"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { body = false } = $$props;
    	let { color = "" } = $$props;
    	let { inverse = false } = $$props;
    	let { outline = false } = $$props;
    	let { style = "" } = $$props;

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(2, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(3, className = $$new_props.class);
    		if ("body" in $$new_props) $$invalidate(4, body = $$new_props.body);
    		if ("color" in $$new_props) $$invalidate(5, color = $$new_props.color);
    		if ("inverse" in $$new_props) $$invalidate(6, inverse = $$new_props.inverse);
    		if ("outline" in $$new_props) $$invalidate(7, outline = $$new_props.outline);
    		if ("style" in $$new_props) $$invalidate(0, style = $$new_props.style);
    		if ("$$scope" in $$new_props) $$invalidate(8, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*className, inverse, body, color, outline*/ 248) {
    			$$invalidate(1, classes = classnames(className, "card", inverse ? "text-white" : false, body ? "card-body" : false, color ? `${outline ? "border" : "bg"}-${color}` : false));
    		}
    	};

    	return [
    		style,
    		classes,
    		$$restProps,
    		className,
    		body,
    		color,
    		inverse,
    		outline,
    		$$scope,
    		slots,
    		click_handler
    	];
    }

    class Card extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			class: 3,
    			body: 4,
    			color: 5,
    			inverse: 6,
    			outline: 7,
    			style: 0
    		});
    	}
    }

    /* node_modules/sveltestrap/src/Col.svelte generated by Svelte v3.32.3 */

    function create_fragment$2(ctx) {
    	let div;
    	let div_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	let div_levels = [
    		/*$$restProps*/ ctx[1],
    		{
    			class: div_class_value = /*colClasses*/ ctx[0].join(" ")
    		}
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
    				}
    			}

    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				dirty & /*$$restProps*/ 2 && /*$$restProps*/ ctx[1],
    				{ class: div_class_value }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	const omit_props_names = ["class","xs","sm","md","lg","xl"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { xs = undefined } = $$props;
    	let { sm = undefined } = $$props;
    	let { md = undefined } = $$props;
    	let { lg = undefined } = $$props;
    	let { xl = undefined } = $$props;
    	const colClasses = [];
    	const lookup = { xs, sm, md, lg, xl };

    	Object.keys(lookup).forEach(colWidth => {
    		const columnProp = lookup[colWidth];

    		if (!columnProp && columnProp !== "") {
    			return; //no value for this width
    		}

    		const isXs = colWidth === "xs";

    		if (isObject(columnProp)) {
    			const colSizeInterfix = isXs ? "-" : `-${colWidth}-`;
    			const colClass = getColumnSizeClass(isXs, colWidth, columnProp.size);

    			if (columnProp.size || columnProp.size === "") {
    				colClasses.push(colClass);
    			}

    			if (columnProp.push) {
    				colClasses.push(`push${colSizeInterfix}${columnProp.push}`);
    			}

    			if (columnProp.pull) {
    				colClasses.push(`pull${colSizeInterfix}${columnProp.pull}`);
    			}

    			if (columnProp.offset) {
    				colClasses.push(`offset${colSizeInterfix}${columnProp.offset}`);
    			}
    		} else {
    			colClasses.push(getColumnSizeClass(isXs, colWidth, columnProp));
    		}
    	});

    	if (!colClasses.length) {
    		colClasses.push("col");
    	}

    	if (className) {
    		colClasses.push(className);
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(1, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
    		if ("xs" in $$new_props) $$invalidate(3, xs = $$new_props.xs);
    		if ("sm" in $$new_props) $$invalidate(4, sm = $$new_props.sm);
    		if ("md" in $$new_props) $$invalidate(5, md = $$new_props.md);
    		if ("lg" in $$new_props) $$invalidate(6, lg = $$new_props.lg);
    		if ("xl" in $$new_props) $$invalidate(7, xl = $$new_props.xl);
    		if ("$$scope" in $$new_props) $$invalidate(8, $$scope = $$new_props.$$scope);
    	};

    	return [colClasses, $$restProps, className, xs, sm, md, lg, xl, $$scope, slots];
    }

    class Col extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			class: 2,
    			xs: 3,
    			sm: 4,
    			md: 5,
    			lg: 6,
    			xl: 7
    		});
    	}
    }

    /* node_modules/sveltestrap/src/Container.svelte generated by Svelte v3.32.3 */

    function create_fragment$3(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);
    	let div_levels = [/*$$restProps*/ ctx[1], { class: /*classes*/ ctx[0] }];
    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 16) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
    				}
    			}

    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				dirty & /*$$restProps*/ 2 && /*$$restProps*/ ctx[1],
    				(!current || dirty & /*classes*/ 1) && { class: /*classes*/ ctx[0] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let classes;
    	const omit_props_names = ["class","fluid"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { fluid = false } = $$props;

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(1, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
    		if ("fluid" in $$new_props) $$invalidate(3, fluid = $$new_props.fluid);
    		if ("$$scope" in $$new_props) $$invalidate(4, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*className, fluid*/ 12) {
    			$$invalidate(0, classes = classnames(className, fluid ? "container-fluid" : "container"));
    		}
    	};

    	return [classes, $$restProps, className, fluid, $$scope, slots];
    }

    class Container extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { class: 2, fluid: 3 });
    	}
    }

    /* node_modules/sveltestrap/src/Form.svelte generated by Svelte v3.32.3 */

    function create_fragment$4(ctx) {
    	let form;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);
    	let form_levels = [/*$$restProps*/ ctx[1], { class: /*classes*/ ctx[0] }];
    	let form_data = {};

    	for (let i = 0; i < form_levels.length; i += 1) {
    		form_data = assign(form_data, form_levels[i]);
    	}

    	return {
    		c() {
    			form = element("form");
    			if (default_slot) default_slot.c();
    			set_attributes(form, form_data);
    		},
    		m(target, anchor) {
    			insert(target, form, anchor);

    			if (default_slot) {
    				default_slot.m(form, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(form, "submit", /*submit_handler*/ ctx[6]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 16) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
    				}
    			}

    			set_attributes(form, form_data = get_spread_update(form_levels, [
    				dirty & /*$$restProps*/ 2 && /*$$restProps*/ ctx[1],
    				(!current || dirty & /*classes*/ 1) && { class: /*classes*/ ctx[0] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(form);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let classes;
    	const omit_props_names = ["class","inline"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { inline = false } = $$props;

    	function submit_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(1, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
    		if ("inline" in $$new_props) $$invalidate(3, inline = $$new_props.inline);
    		if ("$$scope" in $$new_props) $$invalidate(4, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*className, inline*/ 12) {
    			$$invalidate(0, classes = classnames(className, inline ? "form-inline" : false));
    		}
    	};

    	return [classes, $$restProps, className, inline, $$scope, slots, submit_handler];
    }

    class Form extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { class: 2, inline: 3 });
    	}
    }

    /* node_modules/sveltestrap/src/FormGroup.svelte generated by Svelte v3.32.3 */

    function create_else_block$1(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);
    	let div_levels = [/*$$restProps*/ ctx[2], { class: /*classes*/ ctx[1] }];
    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
    				}
    			}

    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				dirty & /*$$restProps*/ 4 && /*$$restProps*/ ctx[2],
    				(!current || dirty & /*classes*/ 2) && { class: /*classes*/ ctx[1] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    // (21:0) {#if tag === 'fieldset'}
    function create_if_block$1(ctx) {
    	let fieldset;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);
    	let fieldset_levels = [/*$$restProps*/ ctx[2], { class: /*classes*/ ctx[1] }];
    	let fieldset_data = {};

    	for (let i = 0; i < fieldset_levels.length; i += 1) {
    		fieldset_data = assign(fieldset_data, fieldset_levels[i]);
    	}

    	return {
    		c() {
    			fieldset = element("fieldset");
    			if (default_slot) default_slot.c();
    			set_attributes(fieldset, fieldset_data);
    		},
    		m(target, anchor) {
    			insert(target, fieldset, anchor);

    			if (default_slot) {
    				default_slot.m(fieldset, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
    				}
    			}

    			set_attributes(fieldset, fieldset_data = get_spread_update(fieldset_levels, [
    				dirty & /*$$restProps*/ 4 && /*$$restProps*/ ctx[2],
    				(!current || dirty & /*classes*/ 2) && { class: /*classes*/ ctx[1] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(fieldset);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*tag*/ ctx[0] === "fieldset") return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let classes;
    	const omit_props_names = ["class","row","check","inline","disabled","tag"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { row = false } = $$props;
    	let { check = false } = $$props;
    	let { inline = false } = $$props;
    	let { disabled = false } = $$props;
    	let { tag = null } = $$props;

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(2, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(3, className = $$new_props.class);
    		if ("row" in $$new_props) $$invalidate(4, row = $$new_props.row);
    		if ("check" in $$new_props) $$invalidate(5, check = $$new_props.check);
    		if ("inline" in $$new_props) $$invalidate(6, inline = $$new_props.inline);
    		if ("disabled" in $$new_props) $$invalidate(7, disabled = $$new_props.disabled);
    		if ("tag" in $$new_props) $$invalidate(0, tag = $$new_props.tag);
    		if ("$$scope" in $$new_props) $$invalidate(8, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*className, row, check, inline, disabled*/ 248) {
    			$$invalidate(1, classes = classnames(className, row ? "row" : false, check ? "form-check" : "form-group", check && inline ? "form-check-inline" : false, check && disabled ? "disabled" : false));
    		}
    	};

    	return [
    		tag,
    		classes,
    		$$restProps,
    		className,
    		row,
    		check,
    		inline,
    		disabled,
    		$$scope,
    		slots
    	];
    }

    class FormGroup extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			class: 3,
    			row: 4,
    			check: 5,
    			inline: 6,
    			disabled: 7,
    			tag: 0
    		});
    	}
    }

    /* node_modules/sveltestrap/src/Input.svelte generated by Svelte v3.32.3 */

    function create_if_block_16(ctx) {
    	let select;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[22].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[21], null);

    	let select_levels = [
    		/*$$restProps*/ ctx[12],
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ readonly: /*readonly*/ ctx[4] }
    	];

    	let select_data = {};

    	for (let i = 0; i < select_levels.length; i += 1) {
    		select_data = assign(select_data, select_levels[i]);
    	}

    	return {
    		c() {
    			select = element("select");
    			if (default_slot) default_slot.c();
    			set_attributes(select, select_data);
    			if (/*value*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[152].call(select));
    		},
    		m(target, anchor) {
    			insert(target, select, anchor);

    			if (default_slot) {
    				default_slot.m(select, null);
    			}

    			if (select_data.multiple) select_options(select, select_data.value);
    			select_option(select, /*value*/ ctx[1]);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(select, "blur", /*blur_handler_16*/ ctx[133]),
    					listen(select, "focus", /*focus_handler_16*/ ctx[134]),
    					listen(select, "change", /*change_handler_15*/ ctx[135]),
    					listen(select, "input", /*input_handler_15*/ ctx[136]),
    					listen(select, "change", /*select_change_handler*/ ctx[152])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty[0] & /*$$scope*/ 2097152) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[21], dirty, null, null);
    				}
    			}

    			set_attributes(select, select_data = get_spread_update(select_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				(!current || dirty[0] & /*classes*/ 512) && { class: /*classes*/ ctx[9] },
    				(!current || dirty[0] & /*name*/ 64) && { name: /*name*/ ctx[6] },
    				(!current || dirty[0] & /*disabled*/ 256) && { disabled: /*disabled*/ ctx[8] },
    				(!current || dirty[0] & /*readonly*/ 16) && { readonly: /*readonly*/ ctx[4] }
    			]));

    			if (dirty[0] & /*$$restProps, classes, name, disabled, readonly*/ 4944 && select_data.multiple) select_options(select, select_data.value);

    			if (dirty[0] & /*value*/ 2) {
    				select_option(select, /*value*/ ctx[1]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(select);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (340:29) 
    function create_if_block_15(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	let textarea_levels = [
    		/*$$restProps*/ ctx[12],
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] },
    		{ readOnly: /*readonly*/ ctx[4] }
    	];

    	let textarea_data = {};

    	for (let i = 0; i < textarea_levels.length; i += 1) {
    		textarea_data = assign(textarea_data, textarea_levels[i]);
    	}

    	return {
    		c() {
    			textarea = element("textarea");
    			set_attributes(textarea, textarea_data);
    		},
    		m(target, anchor) {
    			insert(target, textarea, anchor);
    			set_input_value(textarea, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(textarea, "blur", /*blur_handler_15*/ ctx[126]),
    					listen(textarea, "focus", /*focus_handler_15*/ ctx[127]),
    					listen(textarea, "keydown", /*keydown_handler_15*/ ctx[128]),
    					listen(textarea, "keypress", /*keypress_handler_15*/ ctx[129]),
    					listen(textarea, "keyup", /*keyup_handler_15*/ ctx[130]),
    					listen(textarea, "change", /*change_handler_14*/ ctx[131]),
    					listen(textarea, "input", /*input_handler_14*/ ctx[132]),
    					listen(textarea, "input", /*textarea_input_handler*/ ctx[151])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(textarea, textarea_data = get_spread_update(textarea_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(textarea, /*value*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(textarea);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (82:0) {#if tag === 'input'}
    function create_if_block$2(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*type*/ ctx[3] === "text") return create_if_block_1$1;
    		if (/*type*/ ctx[3] === "password") return create_if_block_2$1;
    		if (/*type*/ ctx[3] === "email") return create_if_block_3$1;
    		if (/*type*/ ctx[3] === "file") return create_if_block_4;
    		if (/*type*/ ctx[3] === "checkbox") return create_if_block_5;
    		if (/*type*/ ctx[3] === "radio") return create_if_block_6;
    		if (/*type*/ ctx[3] === "url") return create_if_block_7;
    		if (/*type*/ ctx[3] === "number") return create_if_block_8;
    		if (/*type*/ ctx[3] === "date") return create_if_block_9;
    		if (/*type*/ ctx[3] === "time") return create_if_block_10;
    		if (/*type*/ ctx[3] === "datetime") return create_if_block_11;
    		if (/*type*/ ctx[3] === "color") return create_if_block_12;
    		if (/*type*/ ctx[3] === "range") return create_if_block_13;
    		if (/*type*/ ctx[3] === "search") return create_if_block_14;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (322:2) {:else}
    function create_else_block$2(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: /*type*/ ctx[3] },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] },
    		{ value: /*value*/ ctx[1] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			input.value = input_data.value;

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_14*/ ctx[121]),
    					listen(input, "focus", /*focus_handler_14*/ ctx[122]),
    					listen(input, "keydown", /*keydown_handler_14*/ ctx[123]),
    					listen(input, "keypress", /*keypress_handler_14*/ ctx[124]),
    					listen(input, "keyup", /*keyup_handler_14*/ ctx[125]),
    					listen(input, "input", /*handleInput*/ ctx[11]),
    					listen(input, "change", /*handleInput*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				dirty[0] & /*type*/ 8 && { type: /*type*/ ctx[3] },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] },
    				dirty[0] & /*value*/ 2 && input.value !== /*value*/ ctx[1] && { value: /*value*/ ctx[1] }
    			]));

    			if ("value" in input_data) {
    				input.value = input_data.value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (305:30) 
    function create_if_block_14(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "search" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_13*/ ctx[114]),
    					listen(input, "focus", /*focus_handler_13*/ ctx[115]),
    					listen(input, "keydown", /*keydown_handler_13*/ ctx[116]),
    					listen(input, "keypress", /*keypress_handler_13*/ ctx[117]),
    					listen(input, "keyup", /*keyup_handler_13*/ ctx[118]),
    					listen(input, "change", /*change_handler_13*/ ctx[119]),
    					listen(input, "input", /*input_handler_13*/ ctx[120]),
    					listen(input, "input", /*input_input_handler_9*/ ctx[150])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "search" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (288:29) 
    function create_if_block_13(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "range" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_12*/ ctx[107]),
    					listen(input, "focus", /*focus_handler_12*/ ctx[108]),
    					listen(input, "keydown", /*keydown_handler_12*/ ctx[109]),
    					listen(input, "keypress", /*keypress_handler_12*/ ctx[110]),
    					listen(input, "keyup", /*keyup_handler_12*/ ctx[111]),
    					listen(input, "change", /*change_handler_12*/ ctx[112]),
    					listen(input, "input", /*input_handler_12*/ ctx[113]),
    					listen(input, "change", /*input_change_input_handler*/ ctx[149]),
    					listen(input, "input", /*input_change_input_handler*/ ctx[149])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "range" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (271:29) 
    function create_if_block_12(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "color" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_11*/ ctx[100]),
    					listen(input, "focus", /*focus_handler_11*/ ctx[101]),
    					listen(input, "keydown", /*keydown_handler_11*/ ctx[102]),
    					listen(input, "keypress", /*keypress_handler_11*/ ctx[103]),
    					listen(input, "keyup", /*keyup_handler_11*/ ctx[104]),
    					listen(input, "change", /*change_handler_11*/ ctx[105]),
    					listen(input, "input", /*input_handler_11*/ ctx[106]),
    					listen(input, "input", /*input_input_handler_8*/ ctx[148])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "color" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (254:32) 
    function create_if_block_11(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "datetime" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_10*/ ctx[93]),
    					listen(input, "focus", /*focus_handler_10*/ ctx[94]),
    					listen(input, "keydown", /*keydown_handler_10*/ ctx[95]),
    					listen(input, "keypress", /*keypress_handler_10*/ ctx[96]),
    					listen(input, "keyup", /*keyup_handler_10*/ ctx[97]),
    					listen(input, "change", /*change_handler_10*/ ctx[98]),
    					listen(input, "input", /*input_handler_10*/ ctx[99]),
    					listen(input, "input", /*input_input_handler_7*/ ctx[147])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "datetime" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (237:28) 
    function create_if_block_10(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "time" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_9*/ ctx[86]),
    					listen(input, "focus", /*focus_handler_9*/ ctx[87]),
    					listen(input, "keydown", /*keydown_handler_9*/ ctx[88]),
    					listen(input, "keypress", /*keypress_handler_9*/ ctx[89]),
    					listen(input, "keyup", /*keyup_handler_9*/ ctx[90]),
    					listen(input, "change", /*change_handler_9*/ ctx[91]),
    					listen(input, "input", /*input_handler_9*/ ctx[92]),
    					listen(input, "input", /*input_input_handler_6*/ ctx[146])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "time" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (220:28) 
    function create_if_block_9(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "date" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_8*/ ctx[79]),
    					listen(input, "focus", /*focus_handler_8*/ ctx[80]),
    					listen(input, "keydown", /*keydown_handler_8*/ ctx[81]),
    					listen(input, "keypress", /*keypress_handler_8*/ ctx[82]),
    					listen(input, "keyup", /*keyup_handler_8*/ ctx[83]),
    					listen(input, "change", /*change_handler_8*/ ctx[84]),
    					listen(input, "input", /*input_handler_8*/ ctx[85]),
    					listen(input, "input", /*input_input_handler_5*/ ctx[145])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "date" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (203:30) 
    function create_if_block_8(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "number" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_7*/ ctx[72]),
    					listen(input, "focus", /*focus_handler_7*/ ctx[73]),
    					listen(input, "keydown", /*keydown_handler_7*/ ctx[74]),
    					listen(input, "keypress", /*keypress_handler_7*/ ctx[75]),
    					listen(input, "keyup", /*keyup_handler_7*/ ctx[76]),
    					listen(input, "change", /*change_handler_7*/ ctx[77]),
    					listen(input, "input", /*input_handler_7*/ ctx[78]),
    					listen(input, "input", /*input_input_handler_4*/ ctx[144])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "number" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2 && to_number(input.value) !== /*value*/ ctx[1]) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (186:27) 
    function create_if_block_7(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "url" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_6*/ ctx[65]),
    					listen(input, "focus", /*focus_handler_6*/ ctx[66]),
    					listen(input, "keydown", /*keydown_handler_6*/ ctx[67]),
    					listen(input, "keypress", /*keypress_handler_6*/ ctx[68]),
    					listen(input, "keyup", /*keyup_handler_6*/ ctx[69]),
    					listen(input, "change", /*change_handler_6*/ ctx[70]),
    					listen(input, "input", /*input_handler_6*/ ctx[71]),
    					listen(input, "input", /*input_input_handler_3*/ ctx[143])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "url" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (169:29) 
    function create_if_block_6(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "radio" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_5*/ ctx[58]),
    					listen(input, "focus", /*focus_handler_5*/ ctx[59]),
    					listen(input, "keydown", /*keydown_handler_5*/ ctx[60]),
    					listen(input, "keypress", /*keypress_handler_5*/ ctx[61]),
    					listen(input, "keyup", /*keyup_handler_5*/ ctx[62]),
    					listen(input, "change", /*change_handler_5*/ ctx[63]),
    					listen(input, "input", /*input_handler_5*/ ctx[64]),
    					listen(input, "change", /*input_change_handler_2*/ ctx[142])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "radio" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (151:32) 
    function create_if_block_5(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "checkbox" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			input.checked = /*checked*/ ctx[0];
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_4*/ ctx[51]),
    					listen(input, "focus", /*focus_handler_4*/ ctx[52]),
    					listen(input, "keydown", /*keydown_handler_4*/ ctx[53]),
    					listen(input, "keypress", /*keypress_handler_4*/ ctx[54]),
    					listen(input, "keyup", /*keyup_handler_4*/ ctx[55]),
    					listen(input, "change", /*change_handler_4*/ ctx[56]),
    					listen(input, "input", /*input_handler_4*/ ctx[57]),
    					listen(input, "change", /*input_change_handler_1*/ ctx[141])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "checkbox" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*checked*/ 1) {
    				input.checked = /*checked*/ ctx[0];
    			}

    			if (dirty[0] & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (134:28) 
    function create_if_block_4(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "file" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_3*/ ctx[44]),
    					listen(input, "focus", /*focus_handler_3*/ ctx[45]),
    					listen(input, "keydown", /*keydown_handler_3*/ ctx[46]),
    					listen(input, "keypress", /*keypress_handler_3*/ ctx[47]),
    					listen(input, "keyup", /*keyup_handler_3*/ ctx[48]),
    					listen(input, "change", /*change_handler_3*/ ctx[49]),
    					listen(input, "input", /*input_handler_3*/ ctx[50]),
    					listen(input, "change", /*input_change_handler*/ ctx[140])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "file" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (117:29) 
    function create_if_block_3$1(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "email" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_2*/ ctx[37]),
    					listen(input, "focus", /*focus_handler_2*/ ctx[38]),
    					listen(input, "keydown", /*keydown_handler_2*/ ctx[39]),
    					listen(input, "keypress", /*keypress_handler_2*/ ctx[40]),
    					listen(input, "keyup", /*keyup_handler_2*/ ctx[41]),
    					listen(input, "change", /*change_handler_2*/ ctx[42]),
    					listen(input, "input", /*input_handler_2*/ ctx[43]),
    					listen(input, "input", /*input_input_handler_2*/ ctx[139])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "email" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2 && input.value !== /*value*/ ctx[1]) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (100:32) 
    function create_if_block_2$1(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "password" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler_1*/ ctx[30]),
    					listen(input, "focus", /*focus_handler_1*/ ctx[31]),
    					listen(input, "keydown", /*keydown_handler_1*/ ctx[32]),
    					listen(input, "keypress", /*keypress_handler_1*/ ctx[33]),
    					listen(input, "keyup", /*keyup_handler_1*/ ctx[34]),
    					listen(input, "change", /*change_handler_1*/ ctx[35]),
    					listen(input, "input", /*input_handler_1*/ ctx[36]),
    					listen(input, "input", /*input_input_handler_1*/ ctx[138])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "password" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2 && input.value !== /*value*/ ctx[1]) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (83:2) {#if type === 'text'}
    function create_if_block_1$1(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	let input_levels = [
    		/*$$restProps*/ ctx[12],
    		{ type: "text" },
    		{ readOnly: /*readonly*/ ctx[4] },
    		{ class: /*classes*/ ctx[9] },
    		{ name: /*name*/ ctx[6] },
    		{ disabled: /*disabled*/ ctx[8] },
    		{ placeholder: /*placeholder*/ ctx[7] }
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	return {
    		c() {
    			input = element("input");
    			set_attributes(input, input_data);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "blur", /*blur_handler*/ ctx[23]),
    					listen(input, "focus", /*focus_handler*/ ctx[24]),
    					listen(input, "keydown", /*keydown_handler*/ ctx[25]),
    					listen(input, "keypress", /*keypress_handler*/ ctx[26]),
    					listen(input, "keyup", /*keyup_handler*/ ctx[27]),
    					listen(input, "change", /*change_handler*/ ctx[28]),
    					listen(input, "input", /*input_handler*/ ctx[29]),
    					listen(input, "input", /*input_input_handler*/ ctx[137])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			set_attributes(input, input_data = get_spread_update(input_levels, [
    				dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12],
    				{ type: "text" },
    				dirty[0] & /*readonly*/ 16 && { readOnly: /*readonly*/ ctx[4] },
    				dirty[0] & /*classes*/ 512 && { class: /*classes*/ ctx[9] },
    				dirty[0] & /*name*/ 64 && { name: /*name*/ ctx[6] },
    				dirty[0] & /*disabled*/ 256 && { disabled: /*disabled*/ ctx[8] },
    				dirty[0] & /*placeholder*/ 128 && { placeholder: /*placeholder*/ ctx[7] }
    			]));

    			if (dirty[0] & /*value*/ 2 && input.value !== /*value*/ ctx[1]) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$2, create_if_block_15, create_if_block_16];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*tag*/ ctx[10] === "input") return 0;
    		if (/*tag*/ ctx[10] === "textarea") return 1;
    		if (/*tag*/ ctx[10] === "select" && !/*multiple*/ ctx[5]) return 2;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(target, anchor);
    			}

    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d(detaching);
    			}

    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	const omit_props_names = [
    		"class","type","size","bsSize","color","checked","valid","invalid","plaintext","addon","value","files","readonly","multiple","name","placeholder","disabled"
    	];

    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { type = "text" } = $$props;
    	let { size = undefined } = $$props;
    	let { bsSize = undefined } = $$props;
    	let { color = undefined } = $$props;
    	let { checked = false } = $$props;
    	let { valid = false } = $$props;
    	let { invalid = false } = $$props;
    	let { plaintext = false } = $$props;
    	let { addon = false } = $$props;
    	let { value = "" } = $$props;
    	let { files = "" } = $$props;
    	let { readonly = undefined } = $$props;
    	let { multiple = undefined } = $$props;
    	let { name = "" } = $$props;
    	let { placeholder = "" } = $$props;
    	let { disabled = undefined } = $$props;
    	let classes;
    	let tag;

    	const handleInput = event => {
    		$$invalidate(1, value = event.target.value);
    	};

    	function blur_handler(event) {
    		bubble($$self, event);
    	}

    	function focus_handler(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler(event) {
    		bubble($$self, event);
    	}

    	function change_handler(event) {
    		bubble($$self, event);
    	}

    	function input_handler(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_1(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_1(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_1(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_1(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_1(event) {
    		bubble($$self, event);
    	}

    	function change_handler_1(event) {
    		bubble($$self, event);
    	}

    	function input_handler_1(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_2(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_2(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_2(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_2(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_2(event) {
    		bubble($$self, event);
    	}

    	function change_handler_2(event) {
    		bubble($$self, event);
    	}

    	function input_handler_2(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_3(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_3(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_3(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_3(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_3(event) {
    		bubble($$self, event);
    	}

    	function change_handler_3(event) {
    		bubble($$self, event);
    	}

    	function input_handler_3(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_4(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_4(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_4(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_4(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_4(event) {
    		bubble($$self, event);
    	}

    	function change_handler_4(event) {
    		bubble($$self, event);
    	}

    	function input_handler_4(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_5(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_5(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_5(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_5(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_5(event) {
    		bubble($$self, event);
    	}

    	function change_handler_5(event) {
    		bubble($$self, event);
    	}

    	function input_handler_5(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_6(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_6(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_6(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_6(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_6(event) {
    		bubble($$self, event);
    	}

    	function change_handler_6(event) {
    		bubble($$self, event);
    	}

    	function input_handler_6(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_7(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_7(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_7(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_7(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_7(event) {
    		bubble($$self, event);
    	}

    	function change_handler_7(event) {
    		bubble($$self, event);
    	}

    	function input_handler_7(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_8(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_8(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_8(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_8(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_8(event) {
    		bubble($$self, event);
    	}

    	function change_handler_8(event) {
    		bubble($$self, event);
    	}

    	function input_handler_8(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_9(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_9(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_9(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_9(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_9(event) {
    		bubble($$self, event);
    	}

    	function change_handler_9(event) {
    		bubble($$self, event);
    	}

    	function input_handler_9(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_10(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_10(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_10(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_10(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_10(event) {
    		bubble($$self, event);
    	}

    	function change_handler_10(event) {
    		bubble($$self, event);
    	}

    	function input_handler_10(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_11(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_11(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_11(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_11(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_11(event) {
    		bubble($$self, event);
    	}

    	function change_handler_11(event) {
    		bubble($$self, event);
    	}

    	function input_handler_11(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_12(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_12(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_12(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_12(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_12(event) {
    		bubble($$self, event);
    	}

    	function change_handler_12(event) {
    		bubble($$self, event);
    	}

    	function input_handler_12(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_13(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_13(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_13(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_13(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_13(event) {
    		bubble($$self, event);
    	}

    	function change_handler_13(event) {
    		bubble($$self, event);
    	}

    	function input_handler_13(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_14(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_14(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_14(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_14(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_14(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_15(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_15(event) {
    		bubble($$self, event);
    	}

    	function keydown_handler_15(event) {
    		bubble($$self, event);
    	}

    	function keypress_handler_15(event) {
    		bubble($$self, event);
    	}

    	function keyup_handler_15(event) {
    		bubble($$self, event);
    	}

    	function change_handler_14(event) {
    		bubble($$self, event);
    	}

    	function input_handler_14(event) {
    		bubble($$self, event);
    	}

    	function blur_handler_16(event) {
    		bubble($$self, event);
    	}

    	function focus_handler_16(event) {
    		bubble($$self, event);
    	}

    	function change_handler_15(event) {
    		bubble($$self, event);
    	}

    	function input_handler_15(event) {
    		bubble($$self, event);
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_input_handler_1() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_input_handler_2() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_change_handler() {
    		files = this.files;
    		$$invalidate(2, files);
    	}

    	function input_change_handler_1() {
    		checked = this.checked;
    		value = this.value;
    		$$invalidate(0, checked);
    		$$invalidate(1, value);
    	}

    	function input_change_handler_2() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_input_handler_3() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_input_handler_4() {
    		value = to_number(this.value);
    		$$invalidate(1, value);
    	}

    	function input_input_handler_5() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_input_handler_6() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_input_handler_7() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_input_handler_8() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input_change_input_handler() {
    		value = to_number(this.value);
    		$$invalidate(1, value);
    	}

    	function input_input_handler_9() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function textarea_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function select_change_handler() {
    		value = select_value(this);
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(12, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(15, className = $$new_props.class);
    		if ("type" in $$new_props) $$invalidate(3, type = $$new_props.type);
    		if ("size" in $$new_props) $$invalidate(13, size = $$new_props.size);
    		if ("bsSize" in $$new_props) $$invalidate(14, bsSize = $$new_props.bsSize);
    		if ("color" in $$new_props) $$invalidate(16, color = $$new_props.color);
    		if ("checked" in $$new_props) $$invalidate(0, checked = $$new_props.checked);
    		if ("valid" in $$new_props) $$invalidate(17, valid = $$new_props.valid);
    		if ("invalid" in $$new_props) $$invalidate(18, invalid = $$new_props.invalid);
    		if ("plaintext" in $$new_props) $$invalidate(19, plaintext = $$new_props.plaintext);
    		if ("addon" in $$new_props) $$invalidate(20, addon = $$new_props.addon);
    		if ("value" in $$new_props) $$invalidate(1, value = $$new_props.value);
    		if ("files" in $$new_props) $$invalidate(2, files = $$new_props.files);
    		if ("readonly" in $$new_props) $$invalidate(4, readonly = $$new_props.readonly);
    		if ("multiple" in $$new_props) $$invalidate(5, multiple = $$new_props.multiple);
    		if ("name" in $$new_props) $$invalidate(6, name = $$new_props.name);
    		if ("placeholder" in $$new_props) $$invalidate(7, placeholder = $$new_props.placeholder);
    		if ("disabled" in $$new_props) $$invalidate(8, disabled = $$new_props.disabled);
    		if ("$$scope" in $$new_props) $$invalidate(21, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*type, plaintext, addon, color, size, className, invalid, valid, bsSize*/ 2088968) {
    			{
    				const checkInput = ["radio", "checkbox"].indexOf(type) > -1;
    				const isNotaNumber = new RegExp("\\D", "g");
    				const fileInput = type === "file";
    				const textareaInput = type === "textarea";
    				const rangeInput = type === "range";
    				const selectInput = type === "select";
    				const buttonInput = type === "button" || type === "reset" || type === "submit";
    				const unsupportedInput = type === "hidden" || type === "image";
    				$$invalidate(10, tag = selectInput || textareaInput ? type : "input");
    				let formControlClass = "form-control";

    				if (plaintext) {
    					formControlClass = `${formControlClass}-plaintext`;
    					$$invalidate(10, tag = "input");
    				} else if (fileInput) {
    					formControlClass = `${formControlClass}-file`;
    				} else if (checkInput) {
    					if (addon) {
    						formControlClass = null;
    					} else {
    						formControlClass = "form-check-input";
    					}
    				} else if (buttonInput) {
    					formControlClass = `btn btn-${color || "secondary"}`;
    				} else if (rangeInput) {
    					formControlClass = "form-control-range";
    				} else if (unsupportedInput) {
    					formControlClass = "";
    				}

    				if (size && isNotaNumber.test(size)) {
    					console.warn("Please use the prop \"bsSize\" instead of the \"size\" to bootstrap's input sizing.");
    					$$invalidate(14, bsSize = size);
    					$$invalidate(13, size = undefined);
    				}

    				$$invalidate(9, classes = classnames(className, invalid && "is-invalid", valid && "is-valid", bsSize ? `form-control-${bsSize}` : false, formControlClass));
    			}
    		}
    	};

    	return [
    		checked,
    		value,
    		files,
    		type,
    		readonly,
    		multiple,
    		name,
    		placeholder,
    		disabled,
    		classes,
    		tag,
    		handleInput,
    		$$restProps,
    		size,
    		bsSize,
    		className,
    		color,
    		valid,
    		invalid,
    		plaintext,
    		addon,
    		$$scope,
    		slots,
    		blur_handler,
    		focus_handler,
    		keydown_handler,
    		keypress_handler,
    		keyup_handler,
    		change_handler,
    		input_handler,
    		blur_handler_1,
    		focus_handler_1,
    		keydown_handler_1,
    		keypress_handler_1,
    		keyup_handler_1,
    		change_handler_1,
    		input_handler_1,
    		blur_handler_2,
    		focus_handler_2,
    		keydown_handler_2,
    		keypress_handler_2,
    		keyup_handler_2,
    		change_handler_2,
    		input_handler_2,
    		blur_handler_3,
    		focus_handler_3,
    		keydown_handler_3,
    		keypress_handler_3,
    		keyup_handler_3,
    		change_handler_3,
    		input_handler_3,
    		blur_handler_4,
    		focus_handler_4,
    		keydown_handler_4,
    		keypress_handler_4,
    		keyup_handler_4,
    		change_handler_4,
    		input_handler_4,
    		blur_handler_5,
    		focus_handler_5,
    		keydown_handler_5,
    		keypress_handler_5,
    		keyup_handler_5,
    		change_handler_5,
    		input_handler_5,
    		blur_handler_6,
    		focus_handler_6,
    		keydown_handler_6,
    		keypress_handler_6,
    		keyup_handler_6,
    		change_handler_6,
    		input_handler_6,
    		blur_handler_7,
    		focus_handler_7,
    		keydown_handler_7,
    		keypress_handler_7,
    		keyup_handler_7,
    		change_handler_7,
    		input_handler_7,
    		blur_handler_8,
    		focus_handler_8,
    		keydown_handler_8,
    		keypress_handler_8,
    		keyup_handler_8,
    		change_handler_8,
    		input_handler_8,
    		blur_handler_9,
    		focus_handler_9,
    		keydown_handler_9,
    		keypress_handler_9,
    		keyup_handler_9,
    		change_handler_9,
    		input_handler_9,
    		blur_handler_10,
    		focus_handler_10,
    		keydown_handler_10,
    		keypress_handler_10,
    		keyup_handler_10,
    		change_handler_10,
    		input_handler_10,
    		blur_handler_11,
    		focus_handler_11,
    		keydown_handler_11,
    		keypress_handler_11,
    		keyup_handler_11,
    		change_handler_11,
    		input_handler_11,
    		blur_handler_12,
    		focus_handler_12,
    		keydown_handler_12,
    		keypress_handler_12,
    		keyup_handler_12,
    		change_handler_12,
    		input_handler_12,
    		blur_handler_13,
    		focus_handler_13,
    		keydown_handler_13,
    		keypress_handler_13,
    		keyup_handler_13,
    		change_handler_13,
    		input_handler_13,
    		blur_handler_14,
    		focus_handler_14,
    		keydown_handler_14,
    		keypress_handler_14,
    		keyup_handler_14,
    		blur_handler_15,
    		focus_handler_15,
    		keydown_handler_15,
    		keypress_handler_15,
    		keyup_handler_15,
    		change_handler_14,
    		input_handler_14,
    		blur_handler_16,
    		focus_handler_16,
    		change_handler_15,
    		input_handler_15,
    		input_input_handler,
    		input_input_handler_1,
    		input_input_handler_2,
    		input_change_handler,
    		input_change_handler_1,
    		input_change_handler_2,
    		input_input_handler_3,
    		input_input_handler_4,
    		input_input_handler_5,
    		input_input_handler_6,
    		input_input_handler_7,
    		input_input_handler_8,
    		input_change_input_handler,
    		input_input_handler_9,
    		textarea_input_handler,
    		select_change_handler
    	];
    }

    class Input extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(
    			this,
    			options,
    			instance$6,
    			create_fragment$6,
    			safe_not_equal,
    			{
    				class: 15,
    				type: 3,
    				size: 13,
    				bsSize: 14,
    				color: 16,
    				checked: 0,
    				valid: 17,
    				invalid: 18,
    				plaintext: 19,
    				addon: 20,
    				value: 1,
    				files: 2,
    				readonly: 4,
    				multiple: 5,
    				name: 6,
    				placeholder: 7,
    				disabled: 8
    			},
    			[-1, -1, -1, -1, -1]
    		);
    	}
    }

    /* node_modules/sveltestrap/src/Label.svelte generated by Svelte v3.32.3 */

    function create_fragment$7(ctx) {
    	let label;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[14].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[13], null);

    	let label_levels = [
    		/*$$restProps*/ ctx[2],
    		{ class: /*classes*/ ctx[1] },
    		{ for: /*fore*/ ctx[0] }
    	];

    	let label_data = {};

    	for (let i = 0; i < label_levels.length; i += 1) {
    		label_data = assign(label_data, label_levels[i]);
    	}

    	return {
    		c() {
    			label = element("label");
    			if (default_slot) default_slot.c();
    			set_attributes(label, label_data);
    		},
    		m(target, anchor) {
    			insert(target, label, anchor);

    			if (default_slot) {
    				default_slot.m(label, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 8192) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[13], dirty, null, null);
    				}
    			}

    			set_attributes(label, label_data = get_spread_update(label_levels, [
    				dirty & /*$$restProps*/ 4 && /*$$restProps*/ ctx[2],
    				(!current || dirty & /*classes*/ 2) && { class: /*classes*/ ctx[1] },
    				(!current || dirty & /*fore*/ 1) && { for: /*fore*/ ctx[0] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(label);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let classes;
    	const omit_props_names = ["class","hidden","check","size","for","xs","sm","md","lg","xl","widths"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { hidden = false } = $$props;
    	let { check = false } = $$props;
    	let { size = "" } = $$props;
    	let { for: fore = null } = $$props;
    	let { xs = "" } = $$props;
    	let { sm = "" } = $$props;
    	let { md = "" } = $$props;
    	let { lg = "" } = $$props;
    	let { xl = "" } = $$props;
    	const colWidths = { xs, sm, md, lg, xl };
    	let { widths = Object.keys(colWidths) } = $$props;
    	const colClasses = [];

    	widths.forEach(colWidth => {
    		let columnProp = $$props[colWidth];

    		if (!columnProp && columnProp !== "") {
    			return;
    		}

    		const isXs = colWidth === "xs";
    		let colClass;

    		if (isObject(columnProp)) {
    			const colSizeInterfix = isXs ? "-" : `-${colWidth}-`;
    			colClass = getColumnSizeClass(isXs, colWidth, columnProp.size);

    			colClasses.push(classnames({
    				[colClass]: columnProp.size || columnProp.size === "",
    				[`order${colSizeInterfix}${columnProp.order}`]: columnProp.order || columnProp.order === 0,
    				[`offset${colSizeInterfix}${columnProp.offset}`]: columnProp.offset || columnProp.offset === 0
    			}));
    		} else {
    			colClass = getColumnSizeClass(isXs, colWidth, columnProp);
    			colClasses.push(colClass);
    		}
    	});

    	$$self.$$set = $$new_props => {
    		$$invalidate(17, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		$$invalidate(2, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(3, className = $$new_props.class);
    		if ("hidden" in $$new_props) $$invalidate(4, hidden = $$new_props.hidden);
    		if ("check" in $$new_props) $$invalidate(5, check = $$new_props.check);
    		if ("size" in $$new_props) $$invalidate(6, size = $$new_props.size);
    		if ("for" in $$new_props) $$invalidate(0, fore = $$new_props.for);
    		if ("xs" in $$new_props) $$invalidate(7, xs = $$new_props.xs);
    		if ("sm" in $$new_props) $$invalidate(8, sm = $$new_props.sm);
    		if ("md" in $$new_props) $$invalidate(9, md = $$new_props.md);
    		if ("lg" in $$new_props) $$invalidate(10, lg = $$new_props.lg);
    		if ("xl" in $$new_props) $$invalidate(11, xl = $$new_props.xl);
    		if ("widths" in $$new_props) $$invalidate(12, widths = $$new_props.widths);
    		if ("$$scope" in $$new_props) $$invalidate(13, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*className, hidden, check, size*/ 120) {
    			$$invalidate(1, classes = classnames(className, hidden ? "sr-only" : false, check ? "form-check-label" : false, size ? `col-form-label-${size}` : false, colClasses, colClasses.length ? "col-form-label" : false));
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		fore,
    		classes,
    		$$restProps,
    		className,
    		hidden,
    		check,
    		size,
    		xs,
    		sm,
    		md,
    		lg,
    		xl,
    		widths,
    		$$scope,
    		slots
    	];
    }

    class Label extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			class: 3,
    			hidden: 4,
    			check: 5,
    			size: 6,
    			for: 0,
    			xs: 7,
    			sm: 8,
    			md: 9,
    			lg: 10,
    			xl: 11,
    			widths: 12
    		});
    	}
    }

    /* node_modules/sveltestrap/src/Row.svelte generated by Svelte v3.32.3 */

    function create_fragment$8(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);
    	let div_levels = [/*$$restProps*/ ctx[1], { class: /*classes*/ ctx[0] }];
    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 64) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[6], dirty, null, null);
    				}
    			}

    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				dirty & /*$$restProps*/ 2 && /*$$restProps*/ ctx[1],
    				(!current || dirty & /*classes*/ 1) && { class: /*classes*/ ctx[0] }
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function getCols(cols) {
    	const colsValue = parseInt(cols);

    	if (!isNaN(colsValue)) {
    		if (colsValue > 0) {
    			return [`row-cols-${colsValue}`];
    		}
    	} else if (typeof cols === "object") {
    		return ["xs", "sm", "md", "lg", "xl"].map(colWidth => {
    			const isXs = colWidth === "xs";
    			const colSizeInterfix = isXs ? "-" : `-${colWidth}-`;
    			const value = cols[colWidth];

    			if (typeof value === "number" && value > 0) {
    				return `row-cols${colSizeInterfix}${value}`;
    			}

    			return null;
    		}).filter(value => !!value);
    	}

    	return [];
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let classes;
    	const omit_props_names = ["class","noGutters","form","cols"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { class: className = "" } = $$props;
    	let { noGutters = false } = $$props;
    	let { form = false } = $$props;
    	let { cols = 0 } = $$props;

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(1, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
    		if ("noGutters" in $$new_props) $$invalidate(3, noGutters = $$new_props.noGutters);
    		if ("form" in $$new_props) $$invalidate(4, form = $$new_props.form);
    		if ("cols" in $$new_props) $$invalidate(5, cols = $$new_props.cols);
    		if ("$$scope" in $$new_props) $$invalidate(6, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*className, noGutters, form, cols*/ 60) {
    			$$invalidate(0, classes = classnames(className, noGutters ? "no-gutters" : null, form ? "form-row" : "row", ...getCols(cols)));
    		}
    	};

    	return [classes, $$restProps, className, noGutters, form, cols, $$scope, slots];
    }

    class Row extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { class: 2, noGutters: 3, form: 4, cols: 5 });
    	}
    }

    const
        getRandomDadJoke = async () => {

            // TODO: It should accept 'text/plain;, but I was not able to figure it out!
            // https://icanhazdadjoke.com/api

            const response = await fetch('https://icanhazdadjoke.com/', {
                headers: {
                    Accept: 'application/json'
                },
            });

            const json = await response.json();
            return json.joke
        };


    const
        searchJokes = async (term) => {

            const response = await fetch(`https://icanhazdadjoke.com/search?term=${term}`, {
                headers: {
                    Accept: 'application/json'
                },
            });

            const json = await response.json();
            return json.results
        };

    /* src/Component/Form.svelte generated by Svelte v3.32.3 */

    function create_default_slot_7(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Term");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (25:12) <Col md="1" xs="2">
    function create_default_slot_6(ctx) {
    	let label;
    	let current;

    	label = new Label({
    			props: {
    				for: "searchField",
    				$$slots: { default: [create_default_slot_7] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(label.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(label, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const label_changes = {};

    			if (dirty & /*$$scope*/ 32) {
    				label_changes.$$scope = { dirty, ctx };
    			}

    			label.$set(label_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(label.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(label.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(label, detaching);
    		}
    	};
    }

    // (28:12) <Col md="7" xs="10">
    function create_default_slot_5(ctx) {
    	let input;
    	let updating_value;
    	let current;

    	function input_value_binding(value) {
    		/*input_value_binding*/ ctx[3](value);
    	}

    	let input_props = {
    		type: "text",
    		id: "searchField",
    		placeholder: "your favorite Joke"
    	};

    	if (/*term*/ ctx[0] !== void 0) {
    		input_props.value = /*term*/ ctx[0];
    	}

    	input = new Input({ props: input_props });
    	binding_callbacks.push(() => bind(input, "value", input_value_binding));

    	return {
    		c() {
    			create_component(input.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(input, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const input_changes = {};

    			if (!updating_value && dirty & /*term*/ 1) {
    				updating_value = true;
    				input_changes.value = /*term*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			input.$set(input_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(input.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(input.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(input, detaching);
    		}
    	};
    }

    // (37:16) <Button disabled={notReady} type="submit" block color="success">
    function create_default_slot_4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Search");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (36:12) <Col md="4">
    function create_default_slot_3(ctx) {
    	let button;
    	let current;

    	button = new Button({
    			props: {
    				disabled: /*notReady*/ ctx[1],
    				type: "submit",
    				block: true,
    				color: "success",
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(button.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const button_changes = {};
    			if (dirty & /*notReady*/ 2) button_changes.disabled = /*notReady*/ ctx[1];

    			if (dirty & /*$$scope*/ 32) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(button, detaching);
    		}
    	};
    }

    // (24:8) <Row>
    function create_default_slot_2(ctx) {
    	let col0;
    	let t0;
    	let col1;
    	let t1;
    	let col2;
    	let current;

    	col0 = new Col({
    			props: {
    				md: "1",
    				xs: "2",
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			}
    		});

    	col1 = new Col({
    			props: {
    				md: "7",
    				xs: "10",
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			}
    		});

    	col2 = new Col({
    			props: {
    				md: "4",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(col0.$$.fragment);
    			t0 = space();
    			create_component(col1.$$.fragment);
    			t1 = space();
    			create_component(col2.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(col0, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(col1, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(col2, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const col0_changes = {};

    			if (dirty & /*$$scope*/ 32) {
    				col0_changes.$$scope = { dirty, ctx };
    			}

    			col0.$set(col0_changes);
    			const col1_changes = {};

    			if (dirty & /*$$scope, term*/ 33) {
    				col1_changes.$$scope = { dirty, ctx };
    			}

    			col1.$set(col1_changes);
    			const col2_changes = {};

    			if (dirty & /*$$scope, notReady*/ 34) {
    				col2_changes.$$scope = { dirty, ctx };
    			}

    			col2.$set(col2_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(col0.$$.fragment, local);
    			transition_in(col1.$$.fragment, local);
    			transition_in(col2.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(col0.$$.fragment, local);
    			transition_out(col1.$$.fragment, local);
    			transition_out(col2.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(col0, detaching);
    			if (detaching) detach(t0);
    			destroy_component(col1, detaching);
    			if (detaching) detach(t1);
    			destroy_component(col2, detaching);
    		}
    	};
    }

    // (23:4) <FormGroup>
    function create_default_slot_1(ctx) {
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(row.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const row_changes = {};

    			if (dirty & /*$$scope, notReady, term*/ 35) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(row, detaching);
    		}
    	};
    }

    // (22:0) <Form on:submit={onSearch}>
    function create_default_slot(ctx) {
    	let formgroup;
    	let current;

    	formgroup = new FormGroup({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(formgroup.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(formgroup, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const formgroup_changes = {};

    			if (dirty & /*$$scope, notReady, term*/ 35) {
    				formgroup_changes.$$scope = { dirty, ctx };
    			}

    			formgroup.$set(formgroup_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(formgroup.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(formgroup.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(formgroup, detaching);
    		}
    	};
    }

    function create_fragment$9(ctx) {
    	let form;
    	let current;

    	form = new Form({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	form.$on("submit", /*onSearch*/ ctx[2]);

    	return {
    		c() {
    			create_component(form.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(form, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const form_changes = {};

    			if (dirty & /*$$scope, notReady, term*/ 35) {
    				form_changes.$$scope = { dirty, ctx };
    			}

    			form.$set(form_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(form.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(form.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(form, detaching);
    		}
    	};
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let notReady;
    	const dispatch = createEventDispatcher();
    	let term = "";

    	const onSearch = e => {
    		e.preventDefault();

    		if (!notReady) {
    			dispatch("search", term);
    		}
    	};

    	function input_value_binding(value) {
    		term = value;
    		$$invalidate(0, term);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*term*/ 1) {
    			$$invalidate(1, notReady = term.length < 5);
    		}
    	};

    	return [term, notReady, onSearch, input_value_binding];
    }

    class Form_1 extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});
    	}
    }

    /* src/Component/Joke.svelte generated by Svelte v3.32.3 */

    function create_default_slot$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*joke*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*joke*/ 1) set_data(t, /*joke*/ ctx[0]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				body: true,
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(card.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const card_changes = {};

    			if (dirty & /*$$scope, joke*/ 3) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(card, detaching);
    		}
    	};
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { joke = "... waiting for a Joke" } = $$props;

    	$$self.$$set = $$props => {
    		if ("joke" in $$props) $$invalidate(0, joke = $$props.joke);
    	};

    	return [joke];
    }

    class Joke extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { joke: 0 });
    	}
    }

    /* src/Component/Title.svelte generated by Svelte v3.32.3 */

    function create_fragment$b(ctx) {
    	let h1;

    	return {
    		c() {
    			h1 = element("h1");
    			h1.textContent = "Dad's Worst Jokes";
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h1);
    		}
    	};
    }

    class Title extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$b, safe_not_equal, {});
    	}
    }

    /* src/Component/Transition.svelte generated by Svelte v3.32.3 */

    function create_fragment$c(ctx) {
    	let div;
    	let div_intro;
    	let div_outro;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	return {
    		c() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 4) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);

    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);

    				if (!div_intro) div_intro = create_in_transition(div, fly, {
    					duration: /*duration*/ ctx[0],
    					y: /*distance*/ ctx[1]
    				});

    				div_intro.start();
    			});

    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			if (div_intro) div_intro.invalidate();

    			div_outro = create_out_transition(div, fly, {
    				duration: /*duration*/ ctx[0],
    				y: /*distance*/ ctx[1]
    			});

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (default_slot) default_slot.d(detaching);
    			if (detaching && div_outro) div_outro.end();
    		}
    	};
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { duration = 1000 } = $$props;
    	let { distance = 200 } = $$props;

    	$$self.$$set = $$props => {
    		if ("duration" in $$props) $$invalidate(0, duration = $$props.duration);
    		if ("distance" in $$props) $$invalidate(1, distance = $$props.distance);
    		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	return [duration, distance, $$scope, slots];
    }

    class Transition extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$b, create_fragment$c, safe_not_equal, { duration: 0, distance: 1 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.32.3 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (52:2) <Button block on:click={onRandomJoke} color="danger">
    function create_default_slot_3$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Get Another Random Joke");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (56:2) {#if mode === "random"}
    function create_if_block_1$2(ctx) {
    	let transition;
    	let current;

    	transition = new Transition({
    			props: {
    				$$slots: { default: [create_default_slot_2$1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(transition.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(transition, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const transition_changes = {};

    			if (dirty & /*$$scope, joke*/ 514) {
    				transition_changes.$$scope = { dirty, ctx };
    			}

    			transition.$set(transition_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(transition.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(transition.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(transition, detaching);
    		}
    	};
    }

    // (57:3) <Transition>
    function create_default_slot_2$1(ctx) {
    	let djjoke;
    	let current;
    	djjoke = new Joke({ props: { joke: /*joke*/ ctx[1] } });

    	return {
    		c() {
    			create_component(djjoke.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(djjoke, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const djjoke_changes = {};
    			if (dirty & /*joke*/ 2) djjoke_changes.joke = /*joke*/ ctx[1];
    			djjoke.$set(djjoke_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(djjoke.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(djjoke.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(djjoke, detaching);
    		}
    	};
    }

    // (61:2) {#if mode === "search"}
    function create_if_block$3(ctx) {
    	let transition;
    	let current;

    	transition = new Transition({
    			props: {
    				$$slots: { default: [create_default_slot_1$1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(transition.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(transition, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const transition_changes = {};

    			if (dirty & /*$$scope, foundJokes, term*/ 524) {
    				transition_changes.$$scope = { dirty, ctx };
    			}

    			transition.$set(transition_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(transition.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(transition.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(transition, detaching);
    		}
    	};
    }

    // (65:4) {:else}
    function create_else_block$3(ctx) {
    	let p;
    	let t0;
    	let t1;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("I don't have any jokes for #");
    			t1 = text(/*term*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*term*/ 8) set_data(t1, /*term*/ ctx[3]);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (63:4) {#each foundJokes as jokeObj}
    function create_each_block(ctx) {
    	let djjoke;
    	let current;
    	djjoke = new Joke({ props: { joke: /*jokeObj*/ ctx[6].joke } });

    	return {
    		c() {
    			create_component(djjoke.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(djjoke, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const djjoke_changes = {};
    			if (dirty & /*foundJokes*/ 4) djjoke_changes.joke = /*jokeObj*/ ctx[6].joke;
    			djjoke.$set(djjoke_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(djjoke.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(djjoke.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(djjoke, detaching);
    		}
    	};
    }

    // (62:3) <Transition>
    function create_default_slot_1$1(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*foundJokes*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block$3(ctx);
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();

    			if (each_1_else) {
    				each_1_else.c();
    			}
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);

    			if (each_1_else) {
    				each_1_else.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty & /*foundJokes, term*/ 12) {
    				each_value = /*foundJokes*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();

    				if (!each_value.length && each_1_else) {
    					each_1_else.p(ctx, dirty);
    				} else if (!each_value.length) {
    					each_1_else = create_else_block$3(ctx);
    					each_1_else.c();
    					each_1_else.m(each_1_anchor.parentNode, each_1_anchor);
    				} else if (each_1_else) {
    					each_1_else.d(1);
    					each_1_else = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    			if (each_1_else) each_1_else.d(detaching);
    		}
    	};
    }

    // (49:1) <Container>
    function create_default_slot$2(ctx) {
    	let djtitle;
    	let t0;
    	let djform;
    	let t1;
    	let button;
    	let t2;
    	let t3;
    	let if_block1_anchor;
    	let current;
    	djtitle = new Title({});
    	djform = new Form_1({});
    	djform.$on("search", /*onSearch*/ ctx[5]);

    	button = new Button({
    			props: {
    				block: true,
    				color: "danger",
    				$$slots: { default: [create_default_slot_3$1] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*onRandomJoke*/ ctx[4]);
    	let if_block0 = /*mode*/ ctx[0] === "random" && create_if_block_1$2(ctx);
    	let if_block1 = /*mode*/ ctx[0] === "search" && create_if_block$3(ctx);

    	return {
    		c() {
    			create_component(djtitle.$$.fragment);
    			t0 = space();
    			create_component(djform.$$.fragment);
    			t1 = space();
    			create_component(button.$$.fragment);
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m(target, anchor) {
    			mount_component(djtitle, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(djform, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(button, target, anchor);
    			insert(target, t2, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t3, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 512) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);

    			if (/*mode*/ ctx[0] === "random") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*mode*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1$2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t3.parentNode, t3);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*mode*/ ctx[0] === "search") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*mode*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$3(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(djtitle.$$.fragment, local);
    			transition_in(djform.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(djtitle.$$.fragment, local);
    			transition_out(djform.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(djtitle, detaching);
    			if (detaching) detach(t0);
    			destroy_component(djform, detaching);
    			if (detaching) detach(t1);
    			destroy_component(button, detaching);
    			if (detaching) detach(t2);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t3);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    		}
    	};
    }

    function create_fragment$d(ctx) {
    	let main;
    	let container;
    	let current;

    	container = new Container({
    			props: {
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			main = element("main");
    			create_component(container.$$.fragment);
    			attr(main, "class", "svelte-jirsbb");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			mount_component(container, main, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const container_changes = {};

    			if (dirty & /*$$scope, foundJokes, term, mode, joke*/ 527) {
    				container_changes.$$scope = { dirty, ctx };
    			}

    			container.$set(container_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(container.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(container.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(container);
    		}
    	};
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let mode = "loading";
    	let joke = "";
    	let foundJokes = [];
    	let term = "";

    	const onRandomJoke = async () => {
    		$$invalidate(0, mode = "loading");

    		try {
    			$$invalidate(1, joke = await getRandomDadJoke());
    			$$invalidate(0, mode = "random");
    		} catch(e) {
    			alert("There was an error!");
    		}
    	};

    	const onSearch = async e => {
    		$$invalidate(0, mode = "loading");
    		$$invalidate(3, term = e.detail);

    		try {
    			$$invalidate(2, foundJokes = await searchJokes(term));

    			// want to erase the search input ... but also erases the error message.
    			// term = ''
    			$$invalidate(0, mode = "search");
    		} catch(e) {
    			alert("There was an error!");
    		}
    	};

    	onMount(async () => {
    		onRandomJoke();
    	});

    	return [mode, joke, foundJokes, term, onRandomJoke, onSearch];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$c, create_fragment$d, safe_not_equal, {});
    	}
    }

    var main = new App({
    		target: document.body,
    	});

    return main;

}());
//# sourceMappingURL=bundle.js.map
