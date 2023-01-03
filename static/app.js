(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('node:path'), require('jsdom')) :
  typeof define === 'function' && define.amd ? define(['node:path', 'jsdom'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(null, global.jsdom));
})(this, (function (path, jsdom) { 'use strict';

  // packages/alpinejs/src/scheduler.js
  var flushPending = false;
  var flushing = false;
  var queue = [];
  function scheduler(callback) {
    queueJob(callback);
  }
  function queueJob(job) {
    if (!queue.includes(job))
      queue.push(job);
    queueFlush();
  }
  function dequeueJob(job) {
    let index = queue.indexOf(job);
    if (index !== -1)
      queue.splice(index, 1);
  }
  function queueFlush() {
    if (!flushing && !flushPending) {
      flushPending = true;
      queueMicrotask(flushJobs);
    }
  }
  function flushJobs() {
    flushPending = false;
    flushing = true;
    for (let i = 0; i < queue.length; i++) {
      queue[i]();
    }
    queue.length = 0;
    flushing = false;
  }

  // packages/alpinejs/src/reactivity.js
  var reactive;
  var effect$3;
  var release;
  var raw;
  var shouldSchedule = true;
  function disableEffectScheduling(callback) {
    shouldSchedule = false;
    callback();
    shouldSchedule = true;
  }
  function setReactivityEngine(engine) {
    reactive = engine.reactive;
    release = engine.release;
    effect$3 = (callback) => engine.effect(callback, {scheduler: (task) => {
      if (shouldSchedule) {
        scheduler(task);
      } else {
        task();
      }
    }});
    raw = engine.raw;
  }
  function overrideEffect(override) {
    effect$3 = override;
  }
  function elementBoundEffect(el) {
    let cleanup2 = () => {
    };
    let wrappedEffect = (callback) => {
      let effectReference = effect$3(callback);
      if (!el._x_effects) {
        el._x_effects = new Set();
        el._x_runEffects = () => {
          el._x_effects.forEach((i) => i());
        };
      }
      el._x_effects.add(effectReference);
      cleanup2 = () => {
        if (effectReference === void 0)
          return;
        el._x_effects.delete(effectReference);
        release(effectReference);
      };
      return effectReference;
    };
    return [wrappedEffect, () => {
      cleanup2();
    }];
  }

  // packages/alpinejs/src/mutation.js
  var onAttributeAddeds = [];
  var onElRemoveds = [];
  var onElAddeds = [];
  function onElAdded(callback) {
    onElAddeds.push(callback);
  }
  function onElRemoved(el, callback) {
    if (typeof callback === "function") {
      if (!el._x_cleanups)
        el._x_cleanups = [];
      el._x_cleanups.push(callback);
    } else {
      callback = el;
      onElRemoveds.push(callback);
    }
  }
  function onAttributesAdded(callback) {
    onAttributeAddeds.push(callback);
  }
  function onAttributeRemoved(el, name, callback) {
    if (!el._x_attributeCleanups)
      el._x_attributeCleanups = {};
    if (!el._x_attributeCleanups[name])
      el._x_attributeCleanups[name] = [];
    el._x_attributeCleanups[name].push(callback);
  }
  function cleanupAttributes(el, names) {
    if (!el._x_attributeCleanups)
      return;
    Object.entries(el._x_attributeCleanups).forEach(([name, value]) => {
      if (names === void 0 || names.includes(name)) {
        value.forEach((i) => i());
        delete el._x_attributeCleanups[name];
      }
    });
  }
  var observer = new MutationObserver(onMutate);
  var currentlyObserving = false;
  function startObservingMutations() {
    observer.observe(document, {subtree: true, childList: true, attributes: true, attributeOldValue: true});
    currentlyObserving = true;
  }
  function stopObservingMutations() {
    flushObserver();
    observer.disconnect();
    currentlyObserving = false;
  }
  var recordQueue = [];
  var willProcessRecordQueue = false;
  function flushObserver() {
    recordQueue = recordQueue.concat(observer.takeRecords());
    if (recordQueue.length && !willProcessRecordQueue) {
      willProcessRecordQueue = true;
      queueMicrotask(() => {
        processRecordQueue();
        willProcessRecordQueue = false;
      });
    }
  }
  function processRecordQueue() {
    onMutate(recordQueue);
    recordQueue.length = 0;
  }
  function mutateDom(callback) {
    if (!currentlyObserving)
      return callback();
    stopObservingMutations();
    let result = callback();
    startObservingMutations();
    return result;
  }
  var isCollecting = false;
  var deferredMutations = [];
  function deferMutations() {
    isCollecting = true;
  }
  function flushAndStopDeferringMutations() {
    isCollecting = false;
    onMutate(deferredMutations);
    deferredMutations = [];
  }
  function onMutate(mutations) {
    if (isCollecting) {
      deferredMutations = deferredMutations.concat(mutations);
      return;
    }
    let addedNodes = [];
    let removedNodes = [];
    let addedAttributes = new Map();
    let removedAttributes = new Map();
    for (let i = 0; i < mutations.length; i++) {
      if (mutations[i].target._x_ignoreMutationObserver)
        continue;
      if (mutations[i].type === "childList") {
        mutations[i].addedNodes.forEach((node) => node.nodeType === 1 && addedNodes.push(node));
        mutations[i].removedNodes.forEach((node) => node.nodeType === 1 && removedNodes.push(node));
      }
      if (mutations[i].type === "attributes") {
        let el = mutations[i].target;
        let name = mutations[i].attributeName;
        let oldValue = mutations[i].oldValue;
        let add2 = () => {
          if (!addedAttributes.has(el))
            addedAttributes.set(el, []);
          addedAttributes.get(el).push({name, value: el.getAttribute(name)});
        };
        let remove = () => {
          if (!removedAttributes.has(el))
            removedAttributes.set(el, []);
          removedAttributes.get(el).push(name);
        };
        if (el.hasAttribute(name) && oldValue === null) {
          add2();
        } else if (el.hasAttribute(name)) {
          remove();
          add2();
        } else {
          remove();
        }
      }
    }
    removedAttributes.forEach((attrs, el) => {
      cleanupAttributes(el, attrs);
    });
    addedAttributes.forEach((attrs, el) => {
      onAttributeAddeds.forEach((i) => i(el, attrs));
    });
    for (let node of removedNodes) {
      if (addedNodes.includes(node))
        continue;
      onElRemoveds.forEach((i) => i(node));
      if (node._x_cleanups) {
        while (node._x_cleanups.length)
          node._x_cleanups.pop()();
      }
    }
    addedNodes.forEach((node) => {
      node._x_ignoreSelf = true;
      node._x_ignore = true;
    });
    for (let node of addedNodes) {
      if (removedNodes.includes(node))
        continue;
      if (!node.isConnected)
        continue;
      delete node._x_ignoreSelf;
      delete node._x_ignore;
      onElAddeds.forEach((i) => i(node));
      node._x_ignore = true;
      node._x_ignoreSelf = true;
    }
    addedNodes.forEach((node) => {
      delete node._x_ignoreSelf;
      delete node._x_ignore;
    });
    addedNodes = null;
    removedNodes = null;
    addedAttributes = null;
    removedAttributes = null;
  }

  // packages/alpinejs/src/scope.js
  function scope(node) {
    return mergeProxies(closestDataStack(node));
  }
  function addScopeToNode(node, data2, referenceNode) {
    node._x_dataStack = [data2, ...closestDataStack(referenceNode || node)];
    return () => {
      node._x_dataStack = node._x_dataStack.filter((i) => i !== data2);
    };
  }
  function refreshScope(element, scope2) {
    let existingScope = element._x_dataStack[0];
    Object.entries(scope2).forEach(([key, value]) => {
      existingScope[key] = value;
    });
  }
  function closestDataStack(node) {
    if (node._x_dataStack)
      return node._x_dataStack;
    if (typeof ShadowRoot === "function" && node instanceof ShadowRoot) {
      return closestDataStack(node.host);
    }
    if (!node.parentNode) {
      return [];
    }
    return closestDataStack(node.parentNode);
  }
  function mergeProxies(objects) {
    let thisProxy = new Proxy({}, {
      ownKeys: () => {
        return Array.from(new Set(objects.flatMap((i) => Object.keys(i))));
      },
      has: (target, name) => {
        return objects.some((obj) => obj.hasOwnProperty(name));
      },
      get: (target, name) => {
        return (objects.find((obj) => {
          if (obj.hasOwnProperty(name)) {
            let descriptor = Object.getOwnPropertyDescriptor(obj, name);
            if (descriptor.get && descriptor.get._x_alreadyBound || descriptor.set && descriptor.set._x_alreadyBound) {
              return true;
            }
            if ((descriptor.get || descriptor.set) && descriptor.enumerable) {
              let getter = descriptor.get;
              let setter = descriptor.set;
              let property = descriptor;
              getter = getter && getter.bind(thisProxy);
              setter = setter && setter.bind(thisProxy);
              if (getter)
                getter._x_alreadyBound = true;
              if (setter)
                setter._x_alreadyBound = true;
              Object.defineProperty(obj, name, {
                ...property,
                get: getter,
                set: setter
              });
            }
            return true;
          }
          return false;
        }) || {})[name];
      },
      set: (target, name, value) => {
        let closestObjectWithKey = objects.find((obj) => obj.hasOwnProperty(name));
        if (closestObjectWithKey) {
          closestObjectWithKey[name] = value;
        } else {
          objects[objects.length - 1][name] = value;
        }
        return true;
      }
    });
    return thisProxy;
  }

  // packages/alpinejs/src/interceptor.js
  function initInterceptors(data2) {
    let isObject2 = (val) => typeof val === "object" && !Array.isArray(val) && val !== null;
    let recurse = (obj, basePath = "") => {
      Object.entries(Object.getOwnPropertyDescriptors(obj)).forEach(([key, {value, enumerable}]) => {
        if (enumerable === false || value === void 0)
          return;
        let path = basePath === "" ? key : `${basePath}.${key}`;
        if (typeof value === "object" && value !== null && value._x_interceptor) {
          obj[key] = value.initialize(data2, path, key);
        } else {
          if (isObject2(value) && value !== obj && !(value instanceof Element)) {
            recurse(value, path);
          }
        }
      });
    };
    return recurse(data2);
  }
  function interceptor(callback, mutateObj = () => {
  }) {
    let obj = {
      initialValue: void 0,
      _x_interceptor: true,
      initialize(data2, path, key) {
        return callback(this.initialValue, () => get(data2, path), (value) => set(data2, path, value), path, key);
      }
    };
    mutateObj(obj);
    return (initialValue) => {
      if (typeof initialValue === "object" && initialValue !== null && initialValue._x_interceptor) {
        let initialize = obj.initialize.bind(obj);
        obj.initialize = (data2, path, key) => {
          let innerValue = initialValue.initialize(data2, path, key);
          obj.initialValue = innerValue;
          return initialize(data2, path, key);
        };
      } else {
        obj.initialValue = initialValue;
      }
      return obj;
    };
  }
  function get(obj, path) {
    return path.split(".").reduce((carry, segment) => carry[segment], obj);
  }
  function set(obj, path, value) {
    if (typeof path === "string")
      path = path.split(".");
    if (path.length === 1)
      obj[path[0]] = value;
    else if (path.length === 0)
      throw error;
    else {
      if (obj[path[0]])
        return set(obj[path[0]], path.slice(1), value);
      else {
        obj[path[0]] = {};
        return set(obj[path[0]], path.slice(1), value);
      }
    }
  }

  // packages/alpinejs/src/magics.js
  var magics = {};
  function magic(name, callback) {
    magics[name] = callback;
  }
  function injectMagics(obj, el) {
    Object.entries(magics).forEach(([name, callback]) => {
      Object.defineProperty(obj, `$${name}`, {
        get() {
          let [utilities, cleanup2] = getElementBoundUtilities(el);
          utilities = {interceptor, ...utilities};
          onElRemoved(el, cleanup2);
          return callback(el, utilities);
        },
        enumerable: false
      });
    });
    return obj;
  }

  // packages/alpinejs/src/utils/error.js
  function tryCatch(el, expression, callback, ...args) {
    try {
      return callback(...args);
    } catch (e) {
      handleError(e, el, expression);
    }
  }
  function handleError(error2, el, expression = void 0) {
    Object.assign(error2, {el, expression});
    console.warn(`Alpine Expression Error: ${error2.message}

${expression ? 'Expression: "' + expression + '"\n\n' : ""}`, el);
    setTimeout(() => {
      throw error2;
    }, 0);
  }

  // packages/alpinejs/src/evaluator.js
  var shouldAutoEvaluateFunctions = true;
  function dontAutoEvaluateFunctions(callback) {
    let cache = shouldAutoEvaluateFunctions;
    shouldAutoEvaluateFunctions = false;
    callback();
    shouldAutoEvaluateFunctions = cache;
  }
  function evaluate(el, expression, extras = {}) {
    let result;
    evaluateLater(el, expression)((value) => result = value, extras);
    return result;
  }
  function evaluateLater(...args) {
    return theEvaluatorFunction(...args);
  }
  var theEvaluatorFunction = normalEvaluator;
  function setEvaluator(newEvaluator) {
    theEvaluatorFunction = newEvaluator;
  }
  function normalEvaluator(el, expression) {
    let overriddenMagics = {};
    injectMagics(overriddenMagics, el);
    let dataStack = [overriddenMagics, ...closestDataStack(el)];
    if (typeof expression === "function") {
      return generateEvaluatorFromFunction(dataStack, expression);
    }
    let evaluator = generateEvaluatorFromString(dataStack, expression, el);
    return tryCatch.bind(null, el, expression, evaluator);
  }
  function generateEvaluatorFromFunction(dataStack, func) {
    return (receiver = () => {
    }, {scope: scope2 = {}, params = []} = {}) => {
      let result = func.apply(mergeProxies([scope2, ...dataStack]), params);
      runIfTypeOfFunction(receiver, result);
    };
  }
  var evaluatorMemo = {};
  function generateFunctionFromString(expression, el) {
    if (evaluatorMemo[expression]) {
      return evaluatorMemo[expression];
    }
    let AsyncFunction = Object.getPrototypeOf(async function() {
    }).constructor;
    let rightSideSafeExpression = /^[\n\s]*if.*\(.*\)/.test(expression) || /^(let|const)\s/.test(expression) ? `(() => { ${expression} })()` : expression;
    const safeAsyncFunction = () => {
      try {
        return new AsyncFunction(["__self", "scope"], `with (scope) { __self.result = ${rightSideSafeExpression} }; __self.finished = true; return __self.result;`);
      } catch (error2) {
        handleError(error2, el, expression);
        return Promise.resolve();
      }
    };
    let func = safeAsyncFunction();
    evaluatorMemo[expression] = func;
    return func;
  }
  function generateEvaluatorFromString(dataStack, expression, el) {
    let func = generateFunctionFromString(expression, el);
    return (receiver = () => {
    }, {scope: scope2 = {}, params = []} = {}) => {
      func.result = void 0;
      func.finished = false;
      let completeScope = mergeProxies([scope2, ...dataStack]);
      if (typeof func === "function") {
        let promise = func(func, completeScope).catch((error2) => handleError(error2, el, expression));
        if (func.finished) {
          runIfTypeOfFunction(receiver, func.result, completeScope, params, el);
          func.result = void 0;
        } else {
          promise.then((result) => {
            runIfTypeOfFunction(receiver, result, completeScope, params, el);
          }).catch((error2) => handleError(error2, el, expression)).finally(() => func.result = void 0);
        }
      }
    };
  }
  function runIfTypeOfFunction(receiver, value, scope2, params, el) {
    if (shouldAutoEvaluateFunctions && typeof value === "function") {
      let result = value.apply(scope2, params);
      if (result instanceof Promise) {
        result.then((i) => runIfTypeOfFunction(receiver, i, scope2, params)).catch((error2) => handleError(error2, el, value));
      } else {
        receiver(result);
      }
    } else {
      receiver(value);
    }
  }

  // packages/alpinejs/src/directives.js
  var prefixAsString = "x-";
  function prefix(subject = "") {
    return prefixAsString + subject;
  }
  function setPrefix(newPrefix) {
    prefixAsString = newPrefix;
  }
  var directiveHandlers = {};
  function directive(name, callback) {
    directiveHandlers[name] = callback;
  }
  function directives(el, attributes, originalAttributeOverride) {
    attributes = Array.from(attributes);
    if (el._x_virtualDirectives) {
      let vAttributes = Object.entries(el._x_virtualDirectives).map(([name, value]) => ({name, value}));
      let staticAttributes = attributesOnly(vAttributes);
      vAttributes = vAttributes.map((attribute) => {
        if (staticAttributes.find((attr) => attr.name === attribute.name)) {
          return {
            name: `x-bind:${attribute.name}`,
            value: `"${attribute.value}"`
          };
        }
        return attribute;
      });
      attributes = attributes.concat(vAttributes);
    }
    let transformedAttributeMap = {};
    let directives2 = attributes.map(toTransformedAttributes((newName, oldName) => transformedAttributeMap[newName] = oldName)).filter(outNonAlpineAttributes).map(toParsedDirectives(transformedAttributeMap, originalAttributeOverride)).sort(byPriority);
    return directives2.map((directive2) => {
      return getDirectiveHandler(el, directive2);
    });
  }
  function attributesOnly(attributes) {
    return Array.from(attributes).map(toTransformedAttributes()).filter((attr) => !outNonAlpineAttributes(attr));
  }
  var isDeferringHandlers = false;
  var directiveHandlerStacks = new Map();
  var currentHandlerStackKey = Symbol();
  function deferHandlingDirectives(callback) {
    isDeferringHandlers = true;
    let key = Symbol();
    currentHandlerStackKey = key;
    directiveHandlerStacks.set(key, []);
    let flushHandlers = () => {
      while (directiveHandlerStacks.get(key).length)
        directiveHandlerStacks.get(key).shift()();
      directiveHandlerStacks.delete(key);
    };
    let stopDeferring = () => {
      isDeferringHandlers = false;
      flushHandlers();
    };
    callback(flushHandlers);
    stopDeferring();
  }
  function getElementBoundUtilities(el) {
    let cleanups = [];
    let cleanup2 = (callback) => cleanups.push(callback);
    let [effect3, cleanupEffect] = elementBoundEffect(el);
    cleanups.push(cleanupEffect);
    let utilities = {
      Alpine: alpine_default,
      effect: effect3,
      cleanup: cleanup2,
      evaluateLater: evaluateLater.bind(evaluateLater, el),
      evaluate: evaluate.bind(evaluate, el)
    };
    let doCleanup = () => cleanups.forEach((i) => i());
    return [utilities, doCleanup];
  }
  function getDirectiveHandler(el, directive2) {
    let noop = () => {
    };
    let handler3 = directiveHandlers[directive2.type] || noop;
    let [utilities, cleanup2] = getElementBoundUtilities(el);
    onAttributeRemoved(el, directive2.original, cleanup2);
    let fullHandler = () => {
      if (el._x_ignore || el._x_ignoreSelf)
        return;
      handler3.inline && handler3.inline(el, directive2, utilities);
      handler3 = handler3.bind(handler3, el, directive2, utilities);
      isDeferringHandlers ? directiveHandlerStacks.get(currentHandlerStackKey).push(handler3) : handler3();
    };
    fullHandler.runCleanups = cleanup2;
    return fullHandler;
  }
  var startingWith = (subject, replacement) => ({name, value}) => {
    if (name.startsWith(subject))
      name = name.replace(subject, replacement);
    return {name, value};
  };
  var into = (i) => i;
  function toTransformedAttributes(callback = () => {
  }) {
    return ({name, value}) => {
      let {name: newName, value: newValue} = attributeTransformers.reduce((carry, transform) => {
        return transform(carry);
      }, {name, value});
      if (newName !== name)
        callback(newName, name);
      return {name: newName, value: newValue};
    };
  }
  var attributeTransformers = [];
  function mapAttributes(callback) {
    attributeTransformers.push(callback);
  }
  function outNonAlpineAttributes({name}) {
    return alpineAttributeRegex().test(name);
  }
  var alpineAttributeRegex = () => new RegExp(`^${prefixAsString}([^:^.]+)\\b`);
  function toParsedDirectives(transformedAttributeMap, originalAttributeOverride) {
    return ({name, value}) => {
      let typeMatch = name.match(alpineAttributeRegex());
      let valueMatch = name.match(/:([a-zA-Z0-9\-:]+)/);
      let modifiers = name.match(/\.[^.\]]+(?=[^\]]*$)/g) || [];
      let original = originalAttributeOverride || transformedAttributeMap[name] || name;
      return {
        type: typeMatch ? typeMatch[1] : null,
        value: valueMatch ? valueMatch[1] : null,
        modifiers: modifiers.map((i) => i.replace(".", "")),
        expression: value,
        original
      };
    };
  }
  var DEFAULT = "DEFAULT";
  var directiveOrder = [
    "ignore",
    "ref",
    "data",
    "id",
    "radio",
    "tabs",
    "switch",
    "disclosure",
    "menu",
    "listbox",
    "list",
    "item",
    "combobox",
    "bind",
    "init",
    "for",
    "mask",
    "model",
    "modelable",
    "transition",
    "show",
    "if",
    DEFAULT,
    "teleport"
  ];
  function byPriority(a, b) {
    let typeA = directiveOrder.indexOf(a.type) === -1 ? DEFAULT : a.type;
    let typeB = directiveOrder.indexOf(b.type) === -1 ? DEFAULT : b.type;
    return directiveOrder.indexOf(typeA) - directiveOrder.indexOf(typeB);
  }

  // packages/alpinejs/src/utils/dispatch.js
  function dispatch(el, name, detail = {}) {
    el.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true
    }));
  }

  // packages/alpinejs/src/nextTick.js
  var tickStack = [];
  var isHolding = false;
  function nextTick(callback = () => {
  }) {
    queueMicrotask(() => {
      isHolding || setTimeout(() => {
        releaseNextTicks();
      });
    });
    return new Promise((res) => {
      tickStack.push(() => {
        callback();
        res();
      });
    });
  }
  function releaseNextTicks() {
    isHolding = false;
    while (tickStack.length)
      tickStack.shift()();
  }
  function holdNextTicks() {
    isHolding = true;
  }

  // packages/alpinejs/src/utils/walk.js
  function walk(el, callback) {
    if (typeof ShadowRoot === "function" && el instanceof ShadowRoot) {
      Array.from(el.children).forEach((el2) => walk(el2, callback));
      return;
    }
    let skip = false;
    callback(el, () => skip = true);
    if (skip)
      return;
    let node = el.firstElementChild;
    while (node) {
      walk(node, callback);
      node = node.nextElementSibling;
    }
  }

  // packages/alpinejs/src/utils/warn.js
  function warn(message, ...args) {
    console.warn(`Alpine Warning: ${message}`, ...args);
  }

  // packages/alpinejs/src/lifecycle.js
  function start$1() {
    if (!document.body)
      warn("Unable to initialize. Trying to load Alpine before `<body>` is available. Did you forget to add `defer` in Alpine's `<script>` tag?");
    dispatch(document, "alpine:init");
    dispatch(document, "alpine:initializing");
    startObservingMutations();
    onElAdded((el) => initTree(el, walk));
    onElRemoved((el) => destroyTree(el));
    onAttributesAdded((el, attrs) => {
      directives(el, attrs).forEach((handle) => handle());
    });
    let outNestedComponents = (el) => !closestRoot(el.parentElement, true);
    Array.from(document.querySelectorAll(allSelectors())).filter(outNestedComponents).forEach((el) => {
      initTree(el);
    });
    dispatch(document, "alpine:initialized");
  }
  var rootSelectorCallbacks = [];
  var initSelectorCallbacks = [];
  function rootSelectors() {
    return rootSelectorCallbacks.map((fn) => fn());
  }
  function allSelectors() {
    return rootSelectorCallbacks.concat(initSelectorCallbacks).map((fn) => fn());
  }
  function addRootSelector(selectorCallback) {
    rootSelectorCallbacks.push(selectorCallback);
  }
  function addInitSelector(selectorCallback) {
    initSelectorCallbacks.push(selectorCallback);
  }
  function closestRoot(el, includeInitSelectors = false) {
    return findClosest(el, (element) => {
      const selectors = includeInitSelectors ? allSelectors() : rootSelectors();
      if (selectors.some((selector) => element.matches(selector)))
        return true;
    });
  }
  function findClosest(el, callback) {
    if (!el)
      return;
    if (callback(el))
      return el;
    if (el._x_teleportBack)
      el = el._x_teleportBack;
    if (!el.parentElement)
      return;
    return findClosest(el.parentElement, callback);
  }
  function isRoot(el) {
    return rootSelectors().some((selector) => el.matches(selector));
  }
  function initTree(el, walker = walk) {
    deferHandlingDirectives(() => {
      walker(el, (el2, skip) => {
        directives(el2, el2.attributes).forEach((handle) => handle());
        el2._x_ignore && skip();
      });
    });
  }
  function destroyTree(root) {
    walk(root, (el) => cleanupAttributes(el));
  }

  // packages/alpinejs/src/utils/classes.js
  function setClasses(el, value) {
    if (Array.isArray(value)) {
      return setClassesFromString(el, value.join(" "));
    } else if (typeof value === "object" && value !== null) {
      return setClassesFromObject(el, value);
    } else if (typeof value === "function") {
      return setClasses(el, value());
    }
    return setClassesFromString(el, value);
  }
  function setClassesFromString(el, classString) {
    let missingClasses = (classString2) => classString2.split(" ").filter((i) => !el.classList.contains(i)).filter(Boolean);
    let addClassesAndReturnUndo = (classes) => {
      el.classList.add(...classes);
      return () => {
        el.classList.remove(...classes);
      };
    };
    classString = classString === true ? classString = "" : classString || "";
    return addClassesAndReturnUndo(missingClasses(classString));
  }
  function setClassesFromObject(el, classObject) {
    let split = (classString) => classString.split(" ").filter(Boolean);
    let forAdd = Object.entries(classObject).flatMap(([classString, bool]) => bool ? split(classString) : false).filter(Boolean);
    let forRemove = Object.entries(classObject).flatMap(([classString, bool]) => !bool ? split(classString) : false).filter(Boolean);
    let added = [];
    let removed = [];
    forRemove.forEach((i) => {
      if (el.classList.contains(i)) {
        el.classList.remove(i);
        removed.push(i);
      }
    });
    forAdd.forEach((i) => {
      if (!el.classList.contains(i)) {
        el.classList.add(i);
        added.push(i);
      }
    });
    return () => {
      removed.forEach((i) => el.classList.add(i));
      added.forEach((i) => el.classList.remove(i));
    };
  }

  // packages/alpinejs/src/utils/styles.js
  function setStyles(el, value) {
    if (typeof value === "object" && value !== null) {
      return setStylesFromObject(el, value);
    }
    return setStylesFromString(el, value);
  }
  function setStylesFromObject(el, value) {
    let previousStyles = {};
    Object.entries(value).forEach(([key, value2]) => {
      previousStyles[key] = el.style[key];
      if (!key.startsWith("--")) {
        key = kebabCase(key);
      }
      el.style.setProperty(key, value2);
    });
    setTimeout(() => {
      if (el.style.length === 0) {
        el.removeAttribute("style");
      }
    });
    return () => {
      setStyles(el, previousStyles);
    };
  }
  function setStylesFromString(el, value) {
    let cache = el.getAttribute("style", value);
    el.setAttribute("style", value);
    return () => {
      el.setAttribute("style", cache || "");
    };
  }
  function kebabCase(subject) {
    return subject.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  }

  // packages/alpinejs/src/utils/once.js
  function once(callback, fallback = () => {
  }) {
    let called = false;
    return function() {
      if (!called) {
        called = true;
        callback.apply(this, arguments);
      } else {
        fallback.apply(this, arguments);
      }
    };
  }

  // packages/alpinejs/src/directives/x-transition.js
  directive("transition", (el, {value, modifiers, expression}, {evaluate: evaluate2}) => {
    if (typeof expression === "function")
      expression = evaluate2(expression);
    if (!expression) {
      registerTransitionsFromHelper(el, modifiers, value);
    } else {
      registerTransitionsFromClassString(el, expression, value);
    }
  });
  function registerTransitionsFromClassString(el, classString, stage) {
    registerTransitionObject(el, setClasses, "");
    let directiveStorageMap = {
      enter: (classes) => {
        el._x_transition.enter.during = classes;
      },
      "enter-start": (classes) => {
        el._x_transition.enter.start = classes;
      },
      "enter-end": (classes) => {
        el._x_transition.enter.end = classes;
      },
      leave: (classes) => {
        el._x_transition.leave.during = classes;
      },
      "leave-start": (classes) => {
        el._x_transition.leave.start = classes;
      },
      "leave-end": (classes) => {
        el._x_transition.leave.end = classes;
      }
    };
    directiveStorageMap[stage](classString);
  }
  function registerTransitionsFromHelper(el, modifiers, stage) {
    registerTransitionObject(el, setStyles);
    let doesntSpecify = !modifiers.includes("in") && !modifiers.includes("out") && !stage;
    let transitioningIn = doesntSpecify || modifiers.includes("in") || ["enter"].includes(stage);
    let transitioningOut = doesntSpecify || modifiers.includes("out") || ["leave"].includes(stage);
    if (modifiers.includes("in") && !doesntSpecify) {
      modifiers = modifiers.filter((i, index) => index < modifiers.indexOf("out"));
    }
    if (modifiers.includes("out") && !doesntSpecify) {
      modifiers = modifiers.filter((i, index) => index > modifiers.indexOf("out"));
    }
    let wantsAll = !modifiers.includes("opacity") && !modifiers.includes("scale");
    let wantsOpacity = wantsAll || modifiers.includes("opacity");
    let wantsScale = wantsAll || modifiers.includes("scale");
    let opacityValue = wantsOpacity ? 0 : 1;
    let scaleValue = wantsScale ? modifierValue(modifiers, "scale", 95) / 100 : 1;
    let delay = modifierValue(modifiers, "delay", 0);
    let origin = modifierValue(modifiers, "origin", "center");
    let property = "opacity, transform";
    let durationIn = modifierValue(modifiers, "duration", 150) / 1e3;
    let durationOut = modifierValue(modifiers, "duration", 75) / 1e3;
    let easing = `cubic-bezier(0.4, 0.0, 0.2, 1)`;
    if (transitioningIn) {
      el._x_transition.enter.during = {
        transformOrigin: origin,
        transitionDelay: delay,
        transitionProperty: property,
        transitionDuration: `${durationIn}s`,
        transitionTimingFunction: easing
      };
      el._x_transition.enter.start = {
        opacity: opacityValue,
        transform: `scale(${scaleValue})`
      };
      el._x_transition.enter.end = {
        opacity: 1,
        transform: `scale(1)`
      };
    }
    if (transitioningOut) {
      el._x_transition.leave.during = {
        transformOrigin: origin,
        transitionDelay: delay,
        transitionProperty: property,
        transitionDuration: `${durationOut}s`,
        transitionTimingFunction: easing
      };
      el._x_transition.leave.start = {
        opacity: 1,
        transform: `scale(1)`
      };
      el._x_transition.leave.end = {
        opacity: opacityValue,
        transform: `scale(${scaleValue})`
      };
    }
  }
  function registerTransitionObject(el, setFunction, defaultValue = {}) {
    if (!el._x_transition)
      el._x_transition = {
        enter: {during: defaultValue, start: defaultValue, end: defaultValue},
        leave: {during: defaultValue, start: defaultValue, end: defaultValue},
        in(before = () => {
        }, after = () => {
        }) {
          transition(el, setFunction, {
            during: this.enter.during,
            start: this.enter.start,
            end: this.enter.end
          }, before, after);
        },
        out(before = () => {
        }, after = () => {
        }) {
          transition(el, setFunction, {
            during: this.leave.during,
            start: this.leave.start,
            end: this.leave.end
          }, before, after);
        }
      };
  }
  window.Element.prototype._x_toggleAndCascadeWithTransitions = function(el, value, show, hide) {
    const nextTick2 = document.visibilityState === "visible" ? requestAnimationFrame : setTimeout;
    let clickAwayCompatibleShow = () => nextTick2(show);
    if (value) {
      if (el._x_transition && (el._x_transition.enter || el._x_transition.leave)) {
        el._x_transition.enter && (Object.entries(el._x_transition.enter.during).length || Object.entries(el._x_transition.enter.start).length || Object.entries(el._x_transition.enter.end).length) ? el._x_transition.in(show) : clickAwayCompatibleShow();
      } else {
        el._x_transition ? el._x_transition.in(show) : clickAwayCompatibleShow();
      }
      return;
    }
    el._x_hidePromise = el._x_transition ? new Promise((resolve, reject) => {
      el._x_transition.out(() => {
      }, () => resolve(hide));
      el._x_transitioning.beforeCancel(() => reject({isFromCancelledTransition: true}));
    }) : Promise.resolve(hide);
    queueMicrotask(() => {
      let closest = closestHide(el);
      if (closest) {
        if (!closest._x_hideChildren)
          closest._x_hideChildren = [];
        closest._x_hideChildren.push(el);
      } else {
        nextTick2(() => {
          let hideAfterChildren = (el2) => {
            let carry = Promise.all([
              el2._x_hidePromise,
              ...(el2._x_hideChildren || []).map(hideAfterChildren)
            ]).then(([i]) => i());
            delete el2._x_hidePromise;
            delete el2._x_hideChildren;
            return carry;
          };
          hideAfterChildren(el).catch((e) => {
            if (!e.isFromCancelledTransition)
              throw e;
          });
        });
      }
    });
  };
  function closestHide(el) {
    let parent = el.parentNode;
    if (!parent)
      return;
    return parent._x_hidePromise ? parent : closestHide(parent);
  }
  function transition(el, setFunction, {during, start: start2, end} = {}, before = () => {
  }, after = () => {
  }) {
    if (el._x_transitioning)
      el._x_transitioning.cancel();
    if (Object.keys(during).length === 0 && Object.keys(start2).length === 0 && Object.keys(end).length === 0) {
      before();
      after();
      return;
    }
    let undoStart, undoDuring, undoEnd;
    performTransition(el, {
      start() {
        undoStart = setFunction(el, start2);
      },
      during() {
        undoDuring = setFunction(el, during);
      },
      before,
      end() {
        undoStart();
        undoEnd = setFunction(el, end);
      },
      after,
      cleanup() {
        undoDuring();
        undoEnd();
      }
    });
  }
  function performTransition(el, stages) {
    let interrupted, reachedBefore, reachedEnd;
    let finish = once(() => {
      mutateDom(() => {
        interrupted = true;
        if (!reachedBefore)
          stages.before();
        if (!reachedEnd) {
          stages.end();
          releaseNextTicks();
        }
        stages.after();
        if (el.isConnected)
          stages.cleanup();
        delete el._x_transitioning;
      });
    });
    el._x_transitioning = {
      beforeCancels: [],
      beforeCancel(callback) {
        this.beforeCancels.push(callback);
      },
      cancel: once(function() {
        while (this.beforeCancels.length) {
          this.beforeCancels.shift()();
        }
        finish();
      }),
      finish
    };
    mutateDom(() => {
      stages.start();
      stages.during();
    });
    holdNextTicks();
    requestAnimationFrame(() => {
      if (interrupted)
        return;
      let duration = Number(getComputedStyle(el).transitionDuration.replace(/,.*/, "").replace("s", "")) * 1e3;
      let delay = Number(getComputedStyle(el).transitionDelay.replace(/,.*/, "").replace("s", "")) * 1e3;
      if (duration === 0)
        duration = Number(getComputedStyle(el).animationDuration.replace("s", "")) * 1e3;
      mutateDom(() => {
        stages.before();
      });
      reachedBefore = true;
      requestAnimationFrame(() => {
        if (interrupted)
          return;
        mutateDom(() => {
          stages.end();
        });
        releaseNextTicks();
        setTimeout(el._x_transitioning.finish, duration + delay);
        reachedEnd = true;
      });
    });
  }
  function modifierValue(modifiers, key, fallback) {
    if (modifiers.indexOf(key) === -1)
      return fallback;
    const rawValue = modifiers[modifiers.indexOf(key) + 1];
    if (!rawValue)
      return fallback;
    if (key === "scale") {
      if (isNaN(rawValue))
        return fallback;
    }
    if (key === "duration") {
      let match = rawValue.match(/([0-9]+)ms/);
      if (match)
        return match[1];
    }
    if (key === "origin") {
      if (["top", "right", "left", "center", "bottom"].includes(modifiers[modifiers.indexOf(key) + 2])) {
        return [rawValue, modifiers[modifiers.indexOf(key) + 2]].join(" ");
      }
    }
    return rawValue;
  }

  // packages/alpinejs/src/clone.js
  var isCloning = false;
  function skipDuringClone(callback, fallback = () => {
  }) {
    return (...args) => isCloning ? fallback(...args) : callback(...args);
  }
  function clone(oldEl, newEl) {
    if (!newEl._x_dataStack)
      newEl._x_dataStack = oldEl._x_dataStack;
    isCloning = true;
    dontRegisterReactiveSideEffects(() => {
      cloneTree(newEl);
    });
    isCloning = false;
  }
  function cloneTree(el) {
    let hasRunThroughFirstEl = false;
    let shallowWalker = (el2, callback) => {
      walk(el2, (el3, skip) => {
        if (hasRunThroughFirstEl && isRoot(el3))
          return skip();
        hasRunThroughFirstEl = true;
        callback(el3, skip);
      });
    };
    initTree(el, shallowWalker);
  }
  function dontRegisterReactiveSideEffects(callback) {
    let cache = effect$3;
    overrideEffect((callback2, el) => {
      let storedEffect = cache(callback2);
      release(storedEffect);
      return () => {
      };
    });
    callback();
    overrideEffect(cache);
  }

  // packages/alpinejs/src/utils/bind.js
  function bind(el, name, value, modifiers = []) {
    if (!el._x_bindings)
      el._x_bindings = reactive({});
    el._x_bindings[name] = value;
    name = modifiers.includes("camel") ? camelCase(name) : name;
    switch (name) {
      case "value":
        bindInputValue(el, value);
        break;
      case "style":
        bindStyles(el, value);
        break;
      case "class":
        bindClasses(el, value);
        break;
      default:
        bindAttribute(el, name, value);
        break;
    }
  }
  function bindInputValue(el, value) {
    if (el.type === "radio") {
      if (el.attributes.value === void 0) {
        el.value = value;
      }
      if (window.fromModel) {
        el.checked = checkedAttrLooseCompare(el.value, value);
      }
    } else if (el.type === "checkbox") {
      if (Number.isInteger(value)) {
        el.value = value;
      } else if (!Number.isInteger(value) && !Array.isArray(value) && typeof value !== "boolean" && ![null, void 0].includes(value)) {
        el.value = String(value);
      } else {
        if (Array.isArray(value)) {
          el.checked = value.some((val) => checkedAttrLooseCompare(val, el.value));
        } else {
          el.checked = !!value;
        }
      }
    } else if (el.tagName === "SELECT") {
      updateSelect(el, value);
    } else {
      if (el.value === value)
        return;
      el.value = value;
    }
  }
  function bindClasses(el, value) {
    if (el._x_undoAddedClasses)
      el._x_undoAddedClasses();
    el._x_undoAddedClasses = setClasses(el, value);
  }
  function bindStyles(el, value) {
    if (el._x_undoAddedStyles)
      el._x_undoAddedStyles();
    el._x_undoAddedStyles = setStyles(el, value);
  }
  function bindAttribute(el, name, value) {
    if ([null, void 0, false].includes(value) && attributeShouldntBePreservedIfFalsy(name)) {
      el.removeAttribute(name);
    } else {
      if (isBooleanAttr(name))
        value = name;
      setIfChanged(el, name, value);
    }
  }
  function setIfChanged(el, attrName, value) {
    if (el.getAttribute(attrName) != value) {
      el.setAttribute(attrName, value);
    }
  }
  function updateSelect(el, value) {
    const arrayWrappedValue = [].concat(value).map((value2) => {
      return value2 + "";
    });
    Array.from(el.options).forEach((option) => {
      option.selected = arrayWrappedValue.includes(option.value);
    });
  }
  function camelCase(subject) {
    return subject.toLowerCase().replace(/-(\w)/g, (match, char) => char.toUpperCase());
  }
  function checkedAttrLooseCompare(valueA, valueB) {
    return valueA == valueB;
  }
  function isBooleanAttr(attrName) {
    const booleanAttributes = [
      "disabled",
      "checked",
      "required",
      "readonly",
      "hidden",
      "open",
      "selected",
      "autofocus",
      "itemscope",
      "multiple",
      "novalidate",
      "allowfullscreen",
      "allowpaymentrequest",
      "formnovalidate",
      "autoplay",
      "controls",
      "loop",
      "muted",
      "playsinline",
      "default",
      "ismap",
      "reversed",
      "async",
      "defer",
      "nomodule"
    ];
    return booleanAttributes.includes(attrName);
  }
  function attributeShouldntBePreservedIfFalsy(name) {
    return !["aria-pressed", "aria-checked", "aria-expanded", "aria-selected"].includes(name);
  }
  function getBinding(el, name, fallback) {
    if (el._x_bindings && el._x_bindings[name] !== void 0)
      return el._x_bindings[name];
    let attr = el.getAttribute(name);
    if (attr === null)
      return typeof fallback === "function" ? fallback() : fallback;
    if (attr === "")
      return true;
    if (isBooleanAttr(name)) {
      return !![name, "true"].includes(attr);
    }
    return attr;
  }

  // packages/alpinejs/src/utils/debounce.js
  function debounce$1(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        func.apply(context, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // packages/alpinejs/src/utils/throttle.js
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      let context = this, args = arguments;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // packages/alpinejs/src/plugin.js
  function plugin(callback) {
    callback(alpine_default);
  }

  // packages/alpinejs/src/store.js
  var stores = {};
  var isReactive = false;
  function store(name, value) {
    if (!isReactive) {
      stores = reactive(stores);
      isReactive = true;
    }
    if (value === void 0) {
      return stores[name];
    }
    stores[name] = value;
    if (typeof value === "object" && value !== null && value.hasOwnProperty("init") && typeof value.init === "function") {
      stores[name].init();
    }
    initInterceptors(stores[name]);
  }
  function getStores() {
    return stores;
  }

  // packages/alpinejs/src/binds.js
  var binds = {};
  function bind2(name, bindings) {
    let getBindings = typeof bindings !== "function" ? () => bindings : bindings;
    if (name instanceof Element) {
      applyBindingsObject(name, getBindings());
    } else {
      binds[name] = getBindings;
    }
  }
  function injectBindingProviders(obj) {
    Object.entries(binds).forEach(([name, callback]) => {
      Object.defineProperty(obj, name, {
        get() {
          return (...args) => {
            return callback(...args);
          };
        }
      });
    });
    return obj;
  }
  function applyBindingsObject(el, obj, original) {
    let cleanupRunners = [];
    while (cleanupRunners.length)
      cleanupRunners.pop()();
    let attributes = Object.entries(obj).map(([name, value]) => ({name, value}));
    let staticAttributes = attributesOnly(attributes);
    attributes = attributes.map((attribute) => {
      if (staticAttributes.find((attr) => attr.name === attribute.name)) {
        return {
          name: `x-bind:${attribute.name}`,
          value: `"${attribute.value}"`
        };
      }
      return attribute;
    });
    directives(el, attributes, original).map((handle) => {
      cleanupRunners.push(handle.runCleanups);
      handle();
    });
  }

  // packages/alpinejs/src/datas.js
  var datas = {};
  function data(name, callback) {
    datas[name] = callback;
  }
  function injectDataProviders(obj, context) {
    Object.entries(datas).forEach(([name, callback]) => {
      Object.defineProperty(obj, name, {
        get() {
          return (...args) => {
            return callback.bind(context)(...args);
          };
        },
        enumerable: false
      });
    });
    return obj;
  }

  // packages/alpinejs/src/alpine.js
  var Alpine = {
    get reactive() {
      return reactive;
    },
    get release() {
      return release;
    },
    get effect() {
      return effect$3;
    },
    get raw() {
      return raw;
    },
    version: "3.10.5",
    flushAndStopDeferringMutations,
    dontAutoEvaluateFunctions,
    disableEffectScheduling,
    setReactivityEngine,
    closestDataStack,
    skipDuringClone,
    addRootSelector,
    addInitSelector,
    addScopeToNode,
    deferMutations,
    mapAttributes,
    evaluateLater,
    setEvaluator,
    mergeProxies,
    findClosest,
    closestRoot,
    interceptor,
    transition,
    setStyles,
    mutateDom,
    directive,
    throttle,
    debounce: debounce$1,
    evaluate,
    initTree,
    nextTick,
    prefixed: prefix,
    prefix: setPrefix,
    plugin,
    magic,
    store,
    start: start$1,
    clone,
    bound: getBinding,
    $data: scope,
    data,
    bind: bind2
  };
  var alpine_default = Alpine;

  // node_modules/@vue/shared/dist/shared.esm-bundler.js
  function makeMap(str, expectsLowerCase) {
    const map = Object.create(null);
    const list = str.split(",");
    for (let i = 0; i < list.length; i++) {
      map[list[i]] = true;
    }
    return expectsLowerCase ? (val) => !!map[val.toLowerCase()] : (val) => !!map[val];
  }
  var EMPTY_OBJ = Object.freeze({}) ;
  var extend = Object.assign;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var hasOwn = (val, key) => hasOwnProperty.call(val, key);
  var isArray = Array.isArray;
  var isMap = (val) => toTypeString(val) === "[object Map]";
  var isString$1 = (val) => typeof val === "string";
  var isSymbol = (val) => typeof val === "symbol";
  var isObject = (val) => val !== null && typeof val === "object";
  var objectToString = Object.prototype.toString;
  var toTypeString = (value) => objectToString.call(value);
  var toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
  };
  var isIntegerKey = (key) => isString$1(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
  var cacheStringFunction = (fn) => {
    const cache = Object.create(null);
    return (str) => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    };
  };
  var capitalize = cacheStringFunction((str) => str.charAt(0).toUpperCase() + str.slice(1));
  var hasChanged = (value, oldValue) => value !== oldValue && (value === value || oldValue === oldValue);

  // node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js
  var targetMap = new WeakMap();
  var effectStack = [];
  var activeEffect;
  var ITERATE_KEY = Symbol("iterate" );
  var MAP_KEY_ITERATE_KEY = Symbol("Map key iterate" );
  function isEffect(fn) {
    return fn && fn._isEffect === true;
  }
  function effect2(fn, options = EMPTY_OBJ) {
    if (isEffect(fn)) {
      fn = fn.raw;
    }
    const effect3 = createReactiveEffect(fn, options);
    if (!options.lazy) {
      effect3();
    }
    return effect3;
  }
  function stop(effect3) {
    if (effect3.active) {
      cleanup(effect3);
      if (effect3.options.onStop) {
        effect3.options.onStop();
      }
      effect3.active = false;
    }
  }
  var uid = 0;
  function createReactiveEffect(fn, options) {
    const effect3 = function reactiveEffect() {
      if (!effect3.active) {
        return fn();
      }
      if (!effectStack.includes(effect3)) {
        cleanup(effect3);
        try {
          enableTracking();
          effectStack.push(effect3);
          activeEffect = effect3;
          return fn();
        } finally {
          effectStack.pop();
          resetTracking();
          activeEffect = effectStack[effectStack.length - 1];
        }
      }
    };
    effect3.id = uid++;
    effect3.allowRecurse = !!options.allowRecurse;
    effect3._isEffect = true;
    effect3.active = true;
    effect3.raw = fn;
    effect3.deps = [];
    effect3.options = options;
    return effect3;
  }
  function cleanup(effect3) {
    const {deps} = effect3;
    if (deps.length) {
      for (let i = 0; i < deps.length; i++) {
        deps[i].delete(effect3);
      }
      deps.length = 0;
    }
  }
  var shouldTrack = true;
  var trackStack = [];
  function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
  }
  function enableTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = true;
  }
  function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === void 0 ? true : last;
  }
  function track(target, type, key) {
    if (!shouldTrack || activeEffect === void 0) {
      return;
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = new Set());
    }
    if (!dep.has(activeEffect)) {
      dep.add(activeEffect);
      activeEffect.deps.push(dep);
      if (activeEffect.options.onTrack) {
        activeEffect.options.onTrack({
          effect: activeEffect,
          target,
          type,
          key
        });
      }
    }
  }
  function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
      return;
    }
    const effects = new Set();
    const add2 = (effectsToAdd) => {
      if (effectsToAdd) {
        effectsToAdd.forEach((effect3) => {
          if (effect3 !== activeEffect || effect3.allowRecurse) {
            effects.add(effect3);
          }
        });
      }
    };
    if (type === "clear") {
      depsMap.forEach(add2);
    } else if (key === "length" && isArray(target)) {
      depsMap.forEach((dep, key2) => {
        if (key2 === "length" || key2 >= newValue) {
          add2(dep);
        }
      });
    } else {
      if (key !== void 0) {
        add2(depsMap.get(key));
      }
      switch (type) {
        case "add":
          if (!isArray(target)) {
            add2(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              add2(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          } else if (isIntegerKey(key)) {
            add2(depsMap.get("length"));
          }
          break;
        case "delete":
          if (!isArray(target)) {
            add2(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              add2(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          }
          break;
        case "set":
          if (isMap(target)) {
            add2(depsMap.get(ITERATE_KEY));
          }
          break;
      }
    }
    const run = (effect3) => {
      if (effect3.options.onTrigger) {
        effect3.options.onTrigger({
          effect: effect3,
          target,
          key,
          type,
          newValue,
          oldValue,
          oldTarget
        });
      }
      if (effect3.options.scheduler) {
        effect3.options.scheduler(effect3);
      } else {
        effect3();
      }
    };
    effects.forEach(run);
  }
  var isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
  var builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol).map((key) => Symbol[key]).filter(isSymbol));
  var get2 = /* @__PURE__ */ createGetter();
  var shallowGet = /* @__PURE__ */ createGetter(false, true);
  var readonlyGet = /* @__PURE__ */ createGetter(true);
  var shallowReadonlyGet = /* @__PURE__ */ createGetter(true, true);
  var arrayInstrumentations = {};
  ["includes", "indexOf", "lastIndexOf"].forEach((key) => {
    const method = Array.prototype[key];
    arrayInstrumentations[key] = function(...args) {
      const arr = toRaw(this);
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, "get", i + "");
      }
      const res = method.apply(arr, args);
      if (res === -1 || res === false) {
        return method.apply(arr, args.map(toRaw));
      } else {
        return res;
      }
    };
  });
  ["push", "pop", "shift", "unshift", "splice"].forEach((key) => {
    const method = Array.prototype[key];
    arrayInstrumentations[key] = function(...args) {
      pauseTracking();
      const res = method.apply(this, args);
      resetTracking();
      return res;
    };
  });
  function createGetter(isReadonly = false, shallow = false) {
    return function get3(target, key, receiver) {
      if (key === "__v_isReactive") {
        return !isReadonly;
      } else if (key === "__v_isReadonly") {
        return isReadonly;
      } else if (key === "__v_raw" && receiver === (isReadonly ? shallow ? shallowReadonlyMap : readonlyMap : shallow ? shallowReactiveMap : reactiveMap).get(target)) {
        return target;
      }
      const targetIsArray = isArray(target);
      if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      const res = Reflect.get(target, key, receiver);
      if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
        return res;
      }
      if (!isReadonly) {
        track(target, "get", key);
      }
      if (shallow) {
        return res;
      }
      if (isRef(res)) {
        const shouldUnwrap = !targetIsArray || !isIntegerKey(key);
        return shouldUnwrap ? res.value : res;
      }
      if (isObject(res)) {
        return isReadonly ? readonly(res) : reactive2(res);
      }
      return res;
    };
  }
  var set2 = /* @__PURE__ */ createSetter();
  var shallowSet = /* @__PURE__ */ createSetter(true);
  function createSetter(shallow = false) {
    return function set3(target, key, value, receiver) {
      let oldValue = target[key];
      if (!shallow) {
        value = toRaw(value);
        oldValue = toRaw(oldValue);
        if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
          oldValue.value = value;
          return true;
        }
      }
      const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
      const result = Reflect.set(target, key, value, receiver);
      if (target === toRaw(receiver)) {
        if (!hadKey) {
          trigger(target, "add", key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set", key, value, oldValue);
        }
      }
      return result;
    };
  }
  function deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, "delete", key, void 0, oldValue);
    }
    return result;
  }
  function has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, "has", key);
    }
    return result;
  }
  function ownKeys(target) {
    track(target, "iterate", isArray(target) ? "length" : ITERATE_KEY);
    return Reflect.ownKeys(target);
  }
  var mutableHandlers = {
    get: get2,
    set: set2,
    deleteProperty,
    has,
    ownKeys
  };
  var readonlyHandlers = {
    get: readonlyGet,
    set(target, key) {
      {
        console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
      }
      return true;
    },
    deleteProperty(target, key) {
      {
        console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
      }
      return true;
    }
  };
  extend({}, mutableHandlers, {
    get: shallowGet,
    set: shallowSet
  });
  extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
  });
  var toReactive = (value) => isObject(value) ? reactive2(value) : value;
  var toReadonly = (value) => isObject(value) ? readonly(value) : value;
  var toShallow = (value) => value;
  var getProto = (v) => Reflect.getPrototypeOf(v);
  function get$1(target, key, isReadonly = false, isShallow = false) {
    target = target["__v_raw"];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);
    if (key !== rawKey) {
      !isReadonly && track(rawTarget, "get", key);
    }
    !isReadonly && track(rawTarget, "get", rawKey);
    const {has: has2} = getProto(rawTarget);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    if (has2.call(rawTarget, key)) {
      return wrap(target.get(key));
    } else if (has2.call(rawTarget, rawKey)) {
      return wrap(target.get(rawKey));
    } else if (target !== rawTarget) {
      target.get(key);
    }
  }
  function has$1(key, isReadonly = false) {
    const target = this["__v_raw"];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);
    if (key !== rawKey) {
      !isReadonly && track(rawTarget, "has", key);
    }
    !isReadonly && track(rawTarget, "has", rawKey);
    return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
  }
  function size(target, isReadonly = false) {
    target = target["__v_raw"];
    !isReadonly && track(toRaw(target), "iterate", ITERATE_KEY);
    return Reflect.get(target, "size", target);
  }
  function add(value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, value);
    if (!hadKey) {
      target.add(value);
      trigger(target, "add", value, value);
    }
    return this;
  }
  function set$1(key, value) {
    value = toRaw(value);
    const target = toRaw(this);
    const {has: has2, get: get3} = getProto(target);
    let hadKey = has2.call(target, key);
    if (!hadKey) {
      key = toRaw(key);
      hadKey = has2.call(target, key);
    } else {
      checkIdentityKeys(target, has2, key);
    }
    const oldValue = get3.call(target, key);
    target.set(key, value);
    if (!hadKey) {
      trigger(target, "add", key, value);
    } else if (hasChanged(value, oldValue)) {
      trigger(target, "set", key, value, oldValue);
    }
    return this;
  }
  function deleteEntry(key) {
    const target = toRaw(this);
    const {has: has2, get: get3} = getProto(target);
    let hadKey = has2.call(target, key);
    if (!hadKey) {
      key = toRaw(key);
      hadKey = has2.call(target, key);
    } else {
      checkIdentityKeys(target, has2, key);
    }
    const oldValue = get3 ? get3.call(target, key) : void 0;
    const result = target.delete(key);
    if (hadKey) {
      trigger(target, "delete", key, void 0, oldValue);
    }
    return result;
  }
  function clear() {
    const target = toRaw(this);
    const hadItems = target.size !== 0;
    const oldTarget = isMap(target) ? new Map(target) : new Set(target) ;
    const result = target.clear();
    if (hadItems) {
      trigger(target, "clear", void 0, void 0, oldTarget);
    }
    return result;
  }
  function createForEach(isReadonly, isShallow) {
    return function forEach(callback, thisArg) {
      const observed = this;
      const target = observed["__v_raw"];
      const rawTarget = toRaw(target);
      const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
      !isReadonly && track(rawTarget, "iterate", ITERATE_KEY);
      return target.forEach((value, key) => {
        return callback.call(thisArg, wrap(value), wrap(key), observed);
      });
    };
  }
  function createIterableMethod(method, isReadonly, isShallow) {
    return function(...args) {
      const target = this["__v_raw"];
      const rawTarget = toRaw(target);
      const targetIsMap = isMap(rawTarget);
      const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
      const isKeyOnly = method === "keys" && targetIsMap;
      const innerIterator = target[method](...args);
      const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
      !isReadonly && track(rawTarget, "iterate", isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
      return {
        next() {
          const {value, done} = innerIterator.next();
          return done ? {value, done} : {
            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
            done
          };
        },
        [Symbol.iterator]() {
          return this;
        }
      };
    };
  }
  function createReadonlyMethod(type) {
    return function(...args) {
      {
        const key = args[0] ? `on key "${args[0]}" ` : ``;
        console.warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
      }
      return type === "delete" ? false : this;
    };
  }
  var mutableInstrumentations = {
    get(key) {
      return get$1(this, key);
    },
    get size() {
      return size(this);
    },
    has: has$1,
    add,
    set: set$1,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false)
  };
  var shallowInstrumentations = {
    get(key) {
      return get$1(this, key, false, true);
    },
    get size() {
      return size(this);
    },
    has: has$1,
    add,
    set: set$1,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true)
  };
  var readonlyInstrumentations = {
    get(key) {
      return get$1(this, key, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has$1.call(this, key, true);
    },
    add: createReadonlyMethod("add"),
    set: createReadonlyMethod("set"),
    delete: createReadonlyMethod("delete"),
    clear: createReadonlyMethod("clear"),
    forEach: createForEach(true, false)
  };
  var shallowReadonlyInstrumentations = {
    get(key) {
      return get$1(this, key, true, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has$1.call(this, key, true);
    },
    add: createReadonlyMethod("add"),
    set: createReadonlyMethod("set"),
    delete: createReadonlyMethod("delete"),
    clear: createReadonlyMethod("clear"),
    forEach: createForEach(true, true)
  };
  var iteratorMethods = ["keys", "values", "entries", Symbol.iterator];
  iteratorMethods.forEach((method) => {
    mutableInstrumentations[method] = createIterableMethod(method, false, false);
    readonlyInstrumentations[method] = createIterableMethod(method, true, false);
    shallowInstrumentations[method] = createIterableMethod(method, false, true);
    shallowReadonlyInstrumentations[method] = createIterableMethod(method, true, true);
  });
  function createInstrumentationGetter(isReadonly, shallow) {
    const instrumentations = shallow ? isReadonly ? shallowReadonlyInstrumentations : shallowInstrumentations : isReadonly ? readonlyInstrumentations : mutableInstrumentations;
    return (target, key, receiver) => {
      if (key === "__v_isReactive") {
        return !isReadonly;
      } else if (key === "__v_isReadonly") {
        return isReadonly;
      } else if (key === "__v_raw") {
        return target;
      }
      return Reflect.get(hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
    };
  }
  var mutableCollectionHandlers = {
    get: createInstrumentationGetter(false, false)
  };
  var readonlyCollectionHandlers = {
    get: createInstrumentationGetter(true, false)
  };
  function checkIdentityKeys(target, has2, key) {
    const rawKey = toRaw(key);
    if (rawKey !== key && has2.call(target, rawKey)) {
      const type = toRawType(target);
      console.warn(`Reactive ${type} contains both the raw and reactive versions of the same object${type === `Map` ? ` as keys` : ``}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`);
    }
  }
  var reactiveMap = new WeakMap();
  var shallowReactiveMap = new WeakMap();
  var readonlyMap = new WeakMap();
  var shallowReadonlyMap = new WeakMap();
  function targetTypeMap(rawType) {
    switch (rawType) {
      case "Object":
      case "Array":
        return 1;
      case "Map":
      case "Set":
      case "WeakMap":
      case "WeakSet":
        return 2;
      default:
        return 0;
    }
  }
  function getTargetType(value) {
    return value["__v_skip"] || !Object.isExtensible(value) ? 0 : targetTypeMap(toRawType(value));
  }
  function reactive2(target) {
    if (target && target["__v_isReadonly"]) {
      return target;
    }
    return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
  }
  function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
  }
  function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap) {
    if (!isObject(target)) {
      {
        console.warn(`value cannot be made reactive: ${String(target)}`);
      }
      return target;
    }
    if (target["__v_raw"] && !(isReadonly && target["__v_isReactive"])) {
      return target;
    }
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
      return existingProxy;
    }
    const targetType = getTargetType(target);
    if (targetType === 0) {
      return target;
    }
    const proxy = new Proxy(target, targetType === 2 ? collectionHandlers : baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
  }
  function toRaw(observed) {
    return observed && toRaw(observed["__v_raw"]) || observed;
  }
  function isRef(r) {
    return Boolean(r && r.__v_isRef === true);
  }

  // packages/alpinejs/src/magics/$nextTick.js
  magic("nextTick", () => nextTick);

  // packages/alpinejs/src/magics/$dispatch.js
  magic("dispatch", (el) => dispatch.bind(dispatch, el));

  // packages/alpinejs/src/magics/$watch.js
  magic("watch", (el, {evaluateLater: evaluateLater2, effect: effect3}) => (key, callback) => {
    let evaluate2 = evaluateLater2(key);
    let firstTime = true;
    let oldValue;
    let effectReference = effect3(() => evaluate2((value) => {
      JSON.stringify(value);
      if (!firstTime) {
        queueMicrotask(() => {
          callback(value, oldValue);
          oldValue = value;
        });
      } else {
        oldValue = value;
      }
      firstTime = false;
    }));
    el._x_effects.delete(effectReference);
  });

  // packages/alpinejs/src/magics/$store.js
  magic("store", getStores);

  // packages/alpinejs/src/magics/$data.js
  magic("data", (el) => scope(el));

  // packages/alpinejs/src/magics/$root.js
  magic("root", (el) => closestRoot(el));

  // packages/alpinejs/src/magics/$refs.js
  magic("refs", (el) => {
    if (el._x_refs_proxy)
      return el._x_refs_proxy;
    el._x_refs_proxy = mergeProxies(getArrayOfRefObject(el));
    return el._x_refs_proxy;
  });
  function getArrayOfRefObject(el) {
    let refObjects = [];
    let currentEl = el;
    while (currentEl) {
      if (currentEl._x_refs)
        refObjects.push(currentEl._x_refs);
      currentEl = currentEl.parentNode;
    }
    return refObjects;
  }

  // packages/alpinejs/src/ids.js
  var globalIdMemo = {};
  function findAndIncrementId(name) {
    if (!globalIdMemo[name])
      globalIdMemo[name] = 0;
    return ++globalIdMemo[name];
  }
  function closestIdRoot(el, name) {
    return findClosest(el, (element) => {
      if (element._x_ids && element._x_ids[name])
        return true;
    });
  }
  function setIdRoot(el, name) {
    if (!el._x_ids)
      el._x_ids = {};
    if (!el._x_ids[name])
      el._x_ids[name] = findAndIncrementId(name);
  }

  // packages/alpinejs/src/magics/$id.js
  magic("id", (el) => (name, key = null) => {
    let root = closestIdRoot(el, name);
    let id = root ? root._x_ids[name] : findAndIncrementId(name);
    return key ? `${name}-${id}-${key}` : `${name}-${id}`;
  });

  // packages/alpinejs/src/magics/$el.js
  magic("el", (el) => el);

  // packages/alpinejs/src/magics/index.js
  warnMissingPluginMagic("Focus", "focus", "focus");
  warnMissingPluginMagic("Persist", "persist", "persist");
  function warnMissingPluginMagic(name, magicName, slug) {
    magic(magicName, (el) => warn(`You can't use [$${directiveName}] without first installing the "${name}" plugin here: https://alpinejs.dev/plugins/${slug}`, el));
  }

  // packages/alpinejs/src/directives/x-modelable.js
  directive("modelable", (el, {expression}, {effect: effect3, evaluateLater: evaluateLater2}) => {
    let func = evaluateLater2(expression);
    let innerGet = () => {
      let result;
      func((i) => result = i);
      return result;
    };
    let evaluateInnerSet = evaluateLater2(`${expression} = __placeholder`);
    let innerSet = (val) => evaluateInnerSet(() => {
    }, {scope: {__placeholder: val}});
    let initialValue = innerGet();
    innerSet(initialValue);
    queueMicrotask(() => {
      if (!el._x_model)
        return;
      el._x_removeModelListeners["default"]();
      let outerGet = el._x_model.get;
      let outerSet = el._x_model.set;
      effect3(() => innerSet(outerGet()));
      effect3(() => outerSet(innerGet()));
    });
  });

  // packages/alpinejs/src/directives/x-teleport.js
  directive("teleport", (el, {expression}, {cleanup: cleanup2}) => {
    if (el.tagName.toLowerCase() !== "template")
      warn("x-teleport can only be used on a <template> tag", el);
    let target = document.querySelector(expression);
    if (!target)
      warn(`Cannot find x-teleport element for selector: "${expression}"`);
    let clone2 = el.content.cloneNode(true).firstElementChild;
    el._x_teleport = clone2;
    clone2._x_teleportBack = el;
    if (el._x_forwardEvents) {
      el._x_forwardEvents.forEach((eventName) => {
        clone2.addEventListener(eventName, (e) => {
          e.stopPropagation();
          el.dispatchEvent(new e.constructor(e.type, e));
        });
      });
    }
    addScopeToNode(clone2, {}, el);
    mutateDom(() => {
      target.appendChild(clone2);
      initTree(clone2);
      clone2._x_ignore = true;
    });
    cleanup2(() => clone2.remove());
  });

  // packages/alpinejs/src/directives/x-ignore.js
  var handler = () => {
  };
  handler.inline = (el, {modifiers}, {cleanup: cleanup2}) => {
    modifiers.includes("self") ? el._x_ignoreSelf = true : el._x_ignore = true;
    cleanup2(() => {
      modifiers.includes("self") ? delete el._x_ignoreSelf : delete el._x_ignore;
    });
  };
  directive("ignore", handler);

  // packages/alpinejs/src/directives/x-effect.js
  directive("effect", (el, {expression}, {effect: effect3}) => effect3(evaluateLater(el, expression)));

  // packages/alpinejs/src/utils/on.js
  function on(el, event, modifiers, callback) {
    let listenerTarget = el;
    let handler3 = (e) => callback(e);
    let options = {};
    let wrapHandler = (callback2, wrapper) => (e) => wrapper(callback2, e);
    if (modifiers.includes("dot"))
      event = dotSyntax(event);
    if (modifiers.includes("camel"))
      event = camelCase2(event);
    if (modifiers.includes("passive"))
      options.passive = true;
    if (modifiers.includes("capture"))
      options.capture = true;
    if (modifiers.includes("window"))
      listenerTarget = window;
    if (modifiers.includes("document"))
      listenerTarget = document;
    if (modifiers.includes("prevent"))
      handler3 = wrapHandler(handler3, (next, e) => {
        e.preventDefault();
        next(e);
      });
    if (modifiers.includes("stop"))
      handler3 = wrapHandler(handler3, (next, e) => {
        e.stopPropagation();
        next(e);
      });
    if (modifiers.includes("self"))
      handler3 = wrapHandler(handler3, (next, e) => {
        e.target === el && next(e);
      });
    if (modifiers.includes("away") || modifiers.includes("outside")) {
      listenerTarget = document;
      handler3 = wrapHandler(handler3, (next, e) => {
        if (el.contains(e.target))
          return;
        if (e.target.isConnected === false)
          return;
        if (el.offsetWidth < 1 && el.offsetHeight < 1)
          return;
        if (el._x_isShown === false)
          return;
        next(e);
      });
    }
    if (modifiers.includes("once")) {
      handler3 = wrapHandler(handler3, (next, e) => {
        next(e);
        listenerTarget.removeEventListener(event, handler3, options);
      });
    }
    handler3 = wrapHandler(handler3, (next, e) => {
      if (isKeyEvent(event)) {
        if (isListeningForASpecificKeyThatHasntBeenPressed(e, modifiers)) {
          return;
        }
      }
      next(e);
    });
    if (modifiers.includes("debounce")) {
      let nextModifier = modifiers[modifiers.indexOf("debounce") + 1] || "invalid-wait";
      let wait = isNumeric(nextModifier.split("ms")[0]) ? Number(nextModifier.split("ms")[0]) : 250;
      handler3 = debounce$1(handler3, wait);
    }
    if (modifiers.includes("throttle")) {
      let nextModifier = modifiers[modifiers.indexOf("throttle") + 1] || "invalid-wait";
      let wait = isNumeric(nextModifier.split("ms")[0]) ? Number(nextModifier.split("ms")[0]) : 250;
      handler3 = throttle(handler3, wait);
    }
    listenerTarget.addEventListener(event, handler3, options);
    return () => {
      listenerTarget.removeEventListener(event, handler3, options);
    };
  }
  function dotSyntax(subject) {
    return subject.replace(/-/g, ".");
  }
  function camelCase2(subject) {
    return subject.toLowerCase().replace(/-(\w)/g, (match, char) => char.toUpperCase());
  }
  function isNumeric(subject) {
    return !Array.isArray(subject) && !isNaN(subject);
  }
  function kebabCase2(subject) {
    return subject.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[_\s]/, "-").toLowerCase();
  }
  function isKeyEvent(event) {
    return ["keydown", "keyup"].includes(event);
  }
  function isListeningForASpecificKeyThatHasntBeenPressed(e, modifiers) {
    let keyModifiers = modifiers.filter((i) => {
      return !["window", "document", "prevent", "stop", "once"].includes(i);
    });
    if (keyModifiers.includes("debounce")) {
      let debounceIndex = keyModifiers.indexOf("debounce");
      keyModifiers.splice(debounceIndex, isNumeric((keyModifiers[debounceIndex + 1] || "invalid-wait").split("ms")[0]) ? 2 : 1);
    }
    if (keyModifiers.length === 0)
      return false;
    if (keyModifiers.length === 1 && keyToModifiers(e.key).includes(keyModifiers[0]))
      return false;
    const systemKeyModifiers = ["ctrl", "shift", "alt", "meta", "cmd", "super"];
    const selectedSystemKeyModifiers = systemKeyModifiers.filter((modifier) => keyModifiers.includes(modifier));
    keyModifiers = keyModifiers.filter((i) => !selectedSystemKeyModifiers.includes(i));
    if (selectedSystemKeyModifiers.length > 0) {
      const activelyPressedKeyModifiers = selectedSystemKeyModifiers.filter((modifier) => {
        if (modifier === "cmd" || modifier === "super")
          modifier = "meta";
        return e[`${modifier}Key`];
      });
      if (activelyPressedKeyModifiers.length === selectedSystemKeyModifiers.length) {
        if (keyToModifiers(e.key).includes(keyModifiers[0]))
          return false;
      }
    }
    return true;
  }
  function keyToModifiers(key) {
    if (!key)
      return [];
    key = kebabCase2(key);
    let modifierToKeyMap = {
      ctrl: "control",
      slash: "/",
      space: "-",
      spacebar: "-",
      cmd: "meta",
      esc: "escape",
      up: "arrow-up",
      down: "arrow-down",
      left: "arrow-left",
      right: "arrow-right",
      period: ".",
      equal: "="
    };
    modifierToKeyMap[key] = key;
    return Object.keys(modifierToKeyMap).map((modifier) => {
      if (modifierToKeyMap[modifier] === key)
        return modifier;
    }).filter((modifier) => modifier);
  }

  // packages/alpinejs/src/directives/x-model.js
  directive("model", (el, {modifiers, expression}, {effect: effect3, cleanup: cleanup2}) => {
    let evaluate2 = evaluateLater(el, expression);
    let assignmentExpression = `${expression} = rightSideOfExpression($event, ${expression})`;
    let evaluateAssignment = evaluateLater(el, assignmentExpression);
    var event = el.tagName.toLowerCase() === "select" || ["checkbox", "radio"].includes(el.type) || modifiers.includes("lazy") ? "change" : "input";
    let assigmentFunction = generateAssignmentFunction(el, modifiers, expression);
    let removeListener = on(el, event, modifiers, (e) => {
      evaluateAssignment(() => {
      }, {scope: {
        $event: e,
        rightSideOfExpression: assigmentFunction
      }});
    });
    if (!el._x_removeModelListeners)
      el._x_removeModelListeners = {};
    el._x_removeModelListeners["default"] = removeListener;
    cleanup2(() => el._x_removeModelListeners["default"]());
    let evaluateSetModel = evaluateLater(el, `${expression} = __placeholder`);
    el._x_model = {
      get() {
        let result;
        evaluate2((value) => result = value);
        return result;
      },
      set(value) {
        evaluateSetModel(() => {
        }, {scope: {__placeholder: value}});
      }
    };
    el._x_forceModelUpdate = () => {
      evaluate2((value) => {
        if (value === void 0 && expression.match(/\./))
          value = "";
        window.fromModel = true;
        mutateDom(() => bind(el, "value", value));
        delete window.fromModel;
      });
    };
    effect3(() => {
      if (modifiers.includes("unintrusive") && document.activeElement.isSameNode(el))
        return;
      el._x_forceModelUpdate();
    });
  });
  function generateAssignmentFunction(el, modifiers, expression) {
    if (el.type === "radio") {
      mutateDom(() => {
        if (!el.hasAttribute("name"))
          el.setAttribute("name", expression);
      });
    }
    return (event, currentValue) => {
      return mutateDom(() => {
        if (event instanceof CustomEvent && event.detail !== void 0) {
          return event.detail || event.target.value;
        } else if (el.type === "checkbox") {
          if (Array.isArray(currentValue)) {
            let newValue = modifiers.includes("number") ? safeParseNumber(event.target.value) : event.target.value;
            return event.target.checked ? currentValue.concat([newValue]) : currentValue.filter((el2) => !checkedAttrLooseCompare2(el2, newValue));
          } else {
            return event.target.checked;
          }
        } else if (el.tagName.toLowerCase() === "select" && el.multiple) {
          return modifiers.includes("number") ? Array.from(event.target.selectedOptions).map((option) => {
            let rawValue = option.value || option.text;
            return safeParseNumber(rawValue);
          }) : Array.from(event.target.selectedOptions).map((option) => {
            return option.value || option.text;
          });
        } else {
          let rawValue = event.target.value;
          return modifiers.includes("number") ? safeParseNumber(rawValue) : modifiers.includes("trim") ? rawValue.trim() : rawValue;
        }
      });
    };
  }
  function safeParseNumber(rawValue) {
    let number = rawValue ? parseFloat(rawValue) : null;
    return isNumeric2(number) ? number : rawValue;
  }
  function checkedAttrLooseCompare2(valueA, valueB) {
    return valueA == valueB;
  }
  function isNumeric2(subject) {
    return !Array.isArray(subject) && !isNaN(subject);
  }

  // packages/alpinejs/src/directives/x-cloak.js
  directive("cloak", (el) => queueMicrotask(() => mutateDom(() => el.removeAttribute(prefix("cloak")))));

  // packages/alpinejs/src/directives/x-init.js
  addInitSelector(() => `[${prefix("init")}]`);
  directive("init", skipDuringClone((el, {expression}, {evaluate: evaluate2}) => {
    if (typeof expression === "string") {
      return !!expression.trim() && evaluate2(expression, {}, false);
    }
    return evaluate2(expression, {}, false);
  }));

  // packages/alpinejs/src/directives/x-text.js
  directive("text", (el, {expression}, {effect: effect3, evaluateLater: evaluateLater2}) => {
    let evaluate2 = evaluateLater2(expression);
    effect3(() => {
      evaluate2((value) => {
        mutateDom(() => {
          el.textContent = value;
        });
      });
    });
  });

  // packages/alpinejs/src/directives/x-html.js
  directive("html", (el, {expression}, {effect: effect3, evaluateLater: evaluateLater2}) => {
    let evaluate2 = evaluateLater2(expression);
    effect3(() => {
      evaluate2((value) => {
        mutateDom(() => {
          el.innerHTML = value;
          el._x_ignoreSelf = true;
          initTree(el);
          delete el._x_ignoreSelf;
        });
      });
    });
  });

  // packages/alpinejs/src/directives/x-bind.js
  mapAttributes(startingWith(":", into(prefix("bind:"))));
  directive("bind", (el, {value, modifiers, expression, original}, {effect: effect3}) => {
    if (!value) {
      let bindingProviders = {};
      injectBindingProviders(bindingProviders);
      let getBindings = evaluateLater(el, expression);
      getBindings((bindings) => {
        applyBindingsObject(el, bindings, original);
      }, {scope: bindingProviders});
      return;
    }
    if (value === "key")
      return storeKeyForXFor(el, expression);
    let evaluate2 = evaluateLater(el, expression);
    effect3(() => evaluate2((result) => {
      if (result === void 0 && typeof expression === "string" && expression.match(/\./)) {
        result = "";
      }
      mutateDom(() => bind(el, value, result, modifiers));
    }));
  });
  function storeKeyForXFor(el, expression) {
    el._x_keyExpression = expression;
  }

  // packages/alpinejs/src/directives/x-data.js
  addRootSelector(() => `[${prefix("data")}]`);
  directive("data", skipDuringClone((el, {expression}, {cleanup: cleanup2}) => {
    expression = expression === "" ? "{}" : expression;
    let magicContext = {};
    injectMagics(magicContext, el);
    let dataProviderContext = {};
    injectDataProviders(dataProviderContext, magicContext);
    let data2 = evaluate(el, expression, {scope: dataProviderContext});
    if (data2 === void 0)
      data2 = {};
    injectMagics(data2, el);
    let reactiveData = reactive(data2);
    initInterceptors(reactiveData);
    let undo = addScopeToNode(el, reactiveData);
    reactiveData["init"] && evaluate(el, reactiveData["init"]);
    cleanup2(() => {
      reactiveData["destroy"] && evaluate(el, reactiveData["destroy"]);
      undo();
    });
  }));

  // packages/alpinejs/src/directives/x-show.js
  directive("show", (el, {modifiers, expression}, {effect: effect3}) => {
    let evaluate2 = evaluateLater(el, expression);
    if (!el._x_doHide)
      el._x_doHide = () => {
        mutateDom(() => {
          el.style.setProperty("display", "none", modifiers.includes("important") ? "important" : void 0);
        });
      };
    if (!el._x_doShow)
      el._x_doShow = () => {
        mutateDom(() => {
          if (el.style.length === 1 && el.style.display === "none") {
            el.removeAttribute("style");
          } else {
            el.style.removeProperty("display");
          }
        });
      };
    let hide = () => {
      el._x_doHide();
      el._x_isShown = false;
    };
    let show = () => {
      el._x_doShow();
      el._x_isShown = true;
    };
    let clickAwayCompatibleShow = () => setTimeout(show);
    let toggle = once((value) => value ? show() : hide(), (value) => {
      if (typeof el._x_toggleAndCascadeWithTransitions === "function") {
        el._x_toggleAndCascadeWithTransitions(el, value, show, hide);
      } else {
        value ? clickAwayCompatibleShow() : hide();
      }
    });
    let oldValue;
    let firstTime = true;
    effect3(() => evaluate2((value) => {
      if (!firstTime && value === oldValue)
        return;
      if (modifiers.includes("immediate"))
        value ? clickAwayCompatibleShow() : hide();
      toggle(value);
      oldValue = value;
      firstTime = false;
    }));
  });

  // packages/alpinejs/src/directives/x-for.js
  directive("for", (el, {expression}, {effect: effect3, cleanup: cleanup2}) => {
    let iteratorNames = parseForExpression(expression);
    let evaluateItems = evaluateLater(el, iteratorNames.items);
    let evaluateKey = evaluateLater(el, el._x_keyExpression || "index");
    el._x_prevKeys = [];
    el._x_lookup = {};
    effect3(() => loop(el, iteratorNames, evaluateItems, evaluateKey));
    cleanup2(() => {
      Object.values(el._x_lookup).forEach((el2) => el2.remove());
      delete el._x_prevKeys;
      delete el._x_lookup;
    });
  });
  function loop(el, iteratorNames, evaluateItems, evaluateKey) {
    let isObject2 = (i) => typeof i === "object" && !Array.isArray(i);
    let templateEl = el;
    evaluateItems((items) => {
      if (isNumeric3(items) && items >= 0) {
        items = Array.from(Array(items).keys(), (i) => i + 1);
      }
      if (items === void 0)
        items = [];
      let lookup = el._x_lookup;
      let prevKeys = el._x_prevKeys;
      let scopes = [];
      let keys = [];
      if (isObject2(items)) {
        items = Object.entries(items).map(([key, value]) => {
          let scope2 = getIterationScopeVariables(iteratorNames, value, key, items);
          evaluateKey((value2) => keys.push(value2), {scope: {index: key, ...scope2}});
          scopes.push(scope2);
        });
      } else {
        for (let i = 0; i < items.length; i++) {
          let scope2 = getIterationScopeVariables(iteratorNames, items[i], i, items);
          evaluateKey((value) => keys.push(value), {scope: {index: i, ...scope2}});
          scopes.push(scope2);
        }
      }
      let adds = [];
      let moves = [];
      let removes = [];
      let sames = [];
      for (let i = 0; i < prevKeys.length; i++) {
        let key = prevKeys[i];
        if (keys.indexOf(key) === -1)
          removes.push(key);
      }
      prevKeys = prevKeys.filter((key) => !removes.includes(key));
      let lastKey = "template";
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let prevIndex = prevKeys.indexOf(key);
        if (prevIndex === -1) {
          prevKeys.splice(i, 0, key);
          adds.push([lastKey, i]);
        } else if (prevIndex !== i) {
          let keyInSpot = prevKeys.splice(i, 1)[0];
          let keyForSpot = prevKeys.splice(prevIndex - 1, 1)[0];
          prevKeys.splice(i, 0, keyForSpot);
          prevKeys.splice(prevIndex, 0, keyInSpot);
          moves.push([keyInSpot, keyForSpot]);
        } else {
          sames.push(key);
        }
        lastKey = key;
      }
      for (let i = 0; i < removes.length; i++) {
        let key = removes[i];
        if (!!lookup[key]._x_effects) {
          lookup[key]._x_effects.forEach(dequeueJob);
        }
        lookup[key].remove();
        lookup[key] = null;
        delete lookup[key];
      }
      for (let i = 0; i < moves.length; i++) {
        let [keyInSpot, keyForSpot] = moves[i];
        let elInSpot = lookup[keyInSpot];
        let elForSpot = lookup[keyForSpot];
        let marker = document.createElement("div");
        mutateDom(() => {
          elForSpot.after(marker);
          elInSpot.after(elForSpot);
          elForSpot._x_currentIfEl && elForSpot.after(elForSpot._x_currentIfEl);
          marker.before(elInSpot);
          elInSpot._x_currentIfEl && elInSpot.after(elInSpot._x_currentIfEl);
          marker.remove();
        });
        refreshScope(elForSpot, scopes[keys.indexOf(keyForSpot)]);
      }
      for (let i = 0; i < adds.length; i++) {
        let [lastKey2, index] = adds[i];
        let lastEl = lastKey2 === "template" ? templateEl : lookup[lastKey2];
        if (lastEl._x_currentIfEl)
          lastEl = lastEl._x_currentIfEl;
        let scope2 = scopes[index];
        let key = keys[index];
        let clone2 = document.importNode(templateEl.content, true).firstElementChild;
        addScopeToNode(clone2, reactive(scope2), templateEl);
        mutateDom(() => {
          lastEl.after(clone2);
          initTree(clone2);
        });
        if (typeof key === "object") {
          warn("x-for key cannot be an object, it must be a string or an integer", templateEl);
        }
        lookup[key] = clone2;
      }
      for (let i = 0; i < sames.length; i++) {
        refreshScope(lookup[sames[i]], scopes[keys.indexOf(sames[i])]);
      }
      templateEl._x_prevKeys = keys;
    });
  }
  function parseForExpression(expression) {
    let forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
    let stripParensRE = /^\s*\(|\)\s*$/g;
    let forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
    let inMatch = expression.match(forAliasRE);
    if (!inMatch)
      return;
    let res = {};
    res.items = inMatch[2].trim();
    let item = inMatch[1].replace(stripParensRE, "").trim();
    let iteratorMatch = item.match(forIteratorRE);
    if (iteratorMatch) {
      res.item = item.replace(forIteratorRE, "").trim();
      res.index = iteratorMatch[1].trim();
      if (iteratorMatch[2]) {
        res.collection = iteratorMatch[2].trim();
      }
    } else {
      res.item = item;
    }
    return res;
  }
  function getIterationScopeVariables(iteratorNames, item, index, items) {
    let scopeVariables = {};
    if (/^\[.*\]$/.test(iteratorNames.item) && Array.isArray(item)) {
      let names = iteratorNames.item.replace("[", "").replace("]", "").split(",").map((i) => i.trim());
      names.forEach((name, i) => {
        scopeVariables[name] = item[i];
      });
    } else if (/^\{.*\}$/.test(iteratorNames.item) && !Array.isArray(item) && typeof item === "object") {
      let names = iteratorNames.item.replace("{", "").replace("}", "").split(",").map((i) => i.trim());
      names.forEach((name) => {
        scopeVariables[name] = item[name];
      });
    } else {
      scopeVariables[iteratorNames.item] = item;
    }
    if (iteratorNames.index)
      scopeVariables[iteratorNames.index] = index;
    if (iteratorNames.collection)
      scopeVariables[iteratorNames.collection] = items;
    return scopeVariables;
  }
  function isNumeric3(subject) {
    return !Array.isArray(subject) && !isNaN(subject);
  }

  // packages/alpinejs/src/directives/x-ref.js
  function handler2() {
  }
  handler2.inline = (el, {expression}, {cleanup: cleanup2}) => {
    let root = closestRoot(el);
    if (!root._x_refs)
      root._x_refs = {};
    root._x_refs[expression] = el;
    cleanup2(() => delete root._x_refs[expression]);
  };
  directive("ref", handler2);

  // packages/alpinejs/src/directives/x-if.js
  directive("if", (el, {expression}, {effect: effect3, cleanup: cleanup2}) => {
    let evaluate2 = evaluateLater(el, expression);
    let show = () => {
      if (el._x_currentIfEl)
        return el._x_currentIfEl;
      let clone2 = el.content.cloneNode(true).firstElementChild;
      addScopeToNode(clone2, {}, el);
      mutateDom(() => {
        el.after(clone2);
        initTree(clone2);
      });
      el._x_currentIfEl = clone2;
      el._x_undoIf = () => {
        walk(clone2, (node) => {
          if (!!node._x_effects) {
            node._x_effects.forEach(dequeueJob);
          }
        });
        clone2.remove();
        delete el._x_currentIfEl;
      };
      return clone2;
    };
    let hide = () => {
      if (!el._x_undoIf)
        return;
      el._x_undoIf();
      delete el._x_undoIf;
    };
    effect3(() => evaluate2((value) => {
      value ? show() : hide();
    }));
    cleanup2(() => el._x_undoIf && el._x_undoIf());
  });

  // packages/alpinejs/src/directives/x-id.js
  directive("id", (el, {expression}, {evaluate: evaluate2}) => {
    let names = evaluate2(expression);
    names.forEach((name) => setIdRoot(el, name));
  });

  // packages/alpinejs/src/directives/x-on.js
  mapAttributes(startingWith("@", into(prefix("on:"))));
  directive("on", skipDuringClone((el, {value, modifiers, expression}, {cleanup: cleanup2}) => {
    let evaluate2 = expression ? evaluateLater(el, expression) : () => {
    };
    if (el.tagName.toLowerCase() === "template") {
      if (!el._x_forwardEvents)
        el._x_forwardEvents = [];
      if (!el._x_forwardEvents.includes(value))
        el._x_forwardEvents.push(value);
    }
    let removeListener = on(el, value, modifiers, (e) => {
      evaluate2(() => {
      }, {scope: {$event: e}, params: [e]});
    });
    cleanup2(() => removeListener());
  }));

  // packages/alpinejs/src/directives/index.js
  warnMissingPluginDirective("Collapse", "collapse", "collapse");
  warnMissingPluginDirective("Intersect", "intersect", "intersect");
  warnMissingPluginDirective("Focus", "trap", "focus");
  warnMissingPluginDirective("Mask", "mask", "mask");
  function warnMissingPluginDirective(name, directiveName2, slug) {
    directive(directiveName2, (el) => warn(`You can't use [x-${directiveName2}] without first installing the "${name}" plugin here: https://alpinejs.dev/plugins/${slug}`, el));
  }

  // packages/alpinejs/src/index.js
  alpine_default.setEvaluator(normalEvaluator);
  alpine_default.setReactivityEngine({reactive: reactive2, effect: effect2, release: stop, raw: toRaw});
  var src_default = alpine_default;

  // packages/alpinejs/builds/module.js
  var module_default = src_default;

  var top = 'top';
  var bottom = 'bottom';
  var right = 'right';
  var left = 'left';
  var auto = 'auto';
  var basePlacements = [top, bottom, right, left];
  var start = 'start';
  var end = 'end';
  var clippingParents = 'clippingParents';
  var viewport = 'viewport';
  var popper = 'popper';
  var reference = 'reference';
  var variationPlacements = /*#__PURE__*/basePlacements.reduce(function (acc, placement) {
    return acc.concat([placement + "-" + start, placement + "-" + end]);
  }, []);
  var placements = /*#__PURE__*/[].concat(basePlacements, [auto]).reduce(function (acc, placement) {
    return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
  }, []); // modifiers that need to read the DOM

  var beforeRead = 'beforeRead';
  var read = 'read';
  var afterRead = 'afterRead'; // pure-logic modifiers

  var beforeMain = 'beforeMain';
  var main = 'main';
  var afterMain = 'afterMain'; // modifier with the purpose to write to the DOM (or write into a framework state)

  var beforeWrite = 'beforeWrite';
  var write = 'write';
  var afterWrite = 'afterWrite';
  var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];

  function getNodeName$1(element) {
    return element ? (element.nodeName || '').toLowerCase() : null;
  }

  function getWindow$1(node) {
    if (node == null) {
      return window;
    }

    if (node.toString() !== '[object Window]') {
      var ownerDocument = node.ownerDocument;
      return ownerDocument ? ownerDocument.defaultView || window : window;
    }

    return node;
  }

  function isElement$3(node) {
    var OwnElement = getWindow$1(node).Element;
    return node instanceof OwnElement || node instanceof Element;
  }

  function isHTMLElement$2(node) {
    var OwnElement = getWindow$1(node).HTMLElement;
    return node instanceof OwnElement || node instanceof HTMLElement;
  }

  function isShadowRoot$1(node) {
    // IE 11 has no ShadowRoot
    if (typeof ShadowRoot === 'undefined') {
      return false;
    }

    var OwnElement = getWindow$1(node).ShadowRoot;
    return node instanceof OwnElement || node instanceof ShadowRoot;
  }

  // and applies them to the HTMLElements such as popper and arrow

  function applyStyles(_ref) {
    var state = _ref.state;
    Object.keys(state.elements).forEach(function (name) {
      var style = state.styles[name] || {};
      var attributes = state.attributes[name] || {};
      var element = state.elements[name]; // arrow is optional + virtual elements

      if (!isHTMLElement$2(element) || !getNodeName$1(element)) {
        return;
      } // Flow doesn't support to extend this property, but it's the most
      // effective way to apply styles to an HTMLElement
      // $FlowFixMe[cannot-write]


      Object.assign(element.style, style);
      Object.keys(attributes).forEach(function (name) {
        var value = attributes[name];

        if (value === false) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value === true ? '' : value);
        }
      });
    });
  }

  function effect$2(_ref2) {
    var state = _ref2.state;
    var initialStyles = {
      popper: {
        position: state.options.strategy,
        left: '0',
        top: '0',
        margin: '0'
      },
      arrow: {
        position: 'absolute'
      },
      reference: {}
    };
    Object.assign(state.elements.popper.style, initialStyles.popper);
    state.styles = initialStyles;

    if (state.elements.arrow) {
      Object.assign(state.elements.arrow.style, initialStyles.arrow);
    }

    return function () {
      Object.keys(state.elements).forEach(function (name) {
        var element = state.elements[name];
        var attributes = state.attributes[name] || {};
        var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]); // Set all values to an empty string to unset them

        var style = styleProperties.reduce(function (style, property) {
          style[property] = '';
          return style;
        }, {}); // arrow is optional + virtual elements

        if (!isHTMLElement$2(element) || !getNodeName$1(element)) {
          return;
        }

        Object.assign(element.style, style);
        Object.keys(attributes).forEach(function (attribute) {
          element.removeAttribute(attribute);
        });
      });
    };
  } // eslint-disable-next-line import/no-unused-modules


  var applyStyles$1 = {
    name: 'applyStyles',
    enabled: true,
    phase: 'write',
    fn: applyStyles,
    effect: effect$2,
    requires: ['computeStyles']
  };

  function getBasePlacement(placement) {
    return placement.split('-')[0];
  }

  var max$2 = Math.max;
  var min$2 = Math.min;
  var round = Math.round;

  function getUAString$1() {
    var uaData = navigator.userAgentData;

    if (uaData != null && uaData.brands) {
      return uaData.brands.map(function (item) {
        return item.brand + "/" + item.version;
      }).join(' ');
    }

    return navigator.userAgent;
  }

  function isLayoutViewport$1() {
    return !/^((?!chrome|android).)*safari/i.test(getUAString$1());
  }

  function getBoundingClientRect$1(element, includeScale, isFixedStrategy) {
    if (includeScale === void 0) {
      includeScale = false;
    }

    if (isFixedStrategy === void 0) {
      isFixedStrategy = false;
    }

    var clientRect = element.getBoundingClientRect();
    var scaleX = 1;
    var scaleY = 1;

    if (includeScale && isHTMLElement$2(element)) {
      scaleX = element.offsetWidth > 0 ? round(clientRect.width) / element.offsetWidth || 1 : 1;
      scaleY = element.offsetHeight > 0 ? round(clientRect.height) / element.offsetHeight || 1 : 1;
    }

    var _ref = isElement$3(element) ? getWindow$1(element) : window,
        visualViewport = _ref.visualViewport;

    var addVisualOffsets = !isLayoutViewport$1() && isFixedStrategy;
    var x = (clientRect.left + (addVisualOffsets && visualViewport ? visualViewport.offsetLeft : 0)) / scaleX;
    var y = (clientRect.top + (addVisualOffsets && visualViewport ? visualViewport.offsetTop : 0)) / scaleY;
    var width = clientRect.width / scaleX;
    var height = clientRect.height / scaleY;
    return {
      width: width,
      height: height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x,
      x: x,
      y: y
    };
  }

  // means it doesn't take into account transforms.

  function getLayoutRect(element) {
    var clientRect = getBoundingClientRect$1(element); // Use the clientRect sizes if it's not been transformed.
    // Fixes https://github.com/popperjs/popper-core/issues/1223

    var width = element.offsetWidth;
    var height = element.offsetHeight;

    if (Math.abs(clientRect.width - width) <= 1) {
      width = clientRect.width;
    }

    if (Math.abs(clientRect.height - height) <= 1) {
      height = clientRect.height;
    }

    return {
      x: element.offsetLeft,
      y: element.offsetTop,
      width: width,
      height: height
    };
  }

  function contains(parent, child) {
    var rootNode = child.getRootNode && child.getRootNode(); // First, attempt with faster native method

    if (parent.contains(child)) {
      return true;
    } // then fallback to custom implementation with Shadow DOM support
    else if (rootNode && isShadowRoot$1(rootNode)) {
        var next = child;

        do {
          if (next && parent.isSameNode(next)) {
            return true;
          } // $FlowFixMe[prop-missing]: need a better way to handle this...


          next = next.parentNode || next.host;
        } while (next);
      } // Give up, the result is false


    return false;
  }

  function getComputedStyle$2(element) {
    return getWindow$1(element).getComputedStyle(element);
  }

  function isTableElement$1(element) {
    return ['table', 'td', 'th'].indexOf(getNodeName$1(element)) >= 0;
  }

  function getDocumentElement$1(element) {
    // $FlowFixMe[incompatible-return]: assume body is always available
    return ((isElement$3(element) ? element.ownerDocument : // $FlowFixMe[prop-missing]
    element.document) || window.document).documentElement;
  }

  function getParentNode$1(element) {
    if (getNodeName$1(element) === 'html') {
      return element;
    }

    return (// this is a quicker (but less type safe) way to save quite some bytes from the bundle
      // $FlowFixMe[incompatible-return]
      // $FlowFixMe[prop-missing]
      element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
      element.parentNode || ( // DOM Element detected
      isShadowRoot$1(element) ? element.host : null) || // ShadowRoot detected
      // $FlowFixMe[incompatible-call]: HTMLElement is a Node
      getDocumentElement$1(element) // fallback

    );
  }

  function getTrueOffsetParent$1(element) {
    if (!isHTMLElement$2(element) || // https://github.com/popperjs/popper-core/issues/837
    getComputedStyle$2(element).position === 'fixed') {
      return null;
    }

    return element.offsetParent;
  } // `.offsetParent` reports `null` for fixed elements, while absolute elements
  // return the containing block


  function getContainingBlock$1(element) {
    var isFirefox = /firefox/i.test(getUAString$1());
    var isIE = /Trident/i.test(getUAString$1());

    if (isIE && isHTMLElement$2(element)) {
      // In IE 9, 10 and 11 fixed elements containing block is always established by the viewport
      var elementCss = getComputedStyle$2(element);

      if (elementCss.position === 'fixed') {
        return null;
      }
    }

    var currentNode = getParentNode$1(element);

    if (isShadowRoot$1(currentNode)) {
      currentNode = currentNode.host;
    }

    while (isHTMLElement$2(currentNode) && ['html', 'body'].indexOf(getNodeName$1(currentNode)) < 0) {
      var css = getComputedStyle$2(currentNode); // This is non-exhaustive but covers the most common CSS properties that
      // create a containing block.
      // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block

      if (css.transform !== 'none' || css.perspective !== 'none' || css.contain === 'paint' || ['transform', 'perspective'].indexOf(css.willChange) !== -1 || isFirefox && css.willChange === 'filter' || isFirefox && css.filter && css.filter !== 'none') {
        return currentNode;
      } else {
        currentNode = currentNode.parentNode;
      }
    }

    return null;
  } // Gets the closest ancestor positioned element. Handles some edge cases,
  // such as table ancestors and cross browser bugs.


  function getOffsetParent$1(element) {
    var window = getWindow$1(element);
    var offsetParent = getTrueOffsetParent$1(element);

    while (offsetParent && isTableElement$1(offsetParent) && getComputedStyle$2(offsetParent).position === 'static') {
      offsetParent = getTrueOffsetParent$1(offsetParent);
    }

    if (offsetParent && (getNodeName$1(offsetParent) === 'html' || getNodeName$1(offsetParent) === 'body' && getComputedStyle$2(offsetParent).position === 'static')) {
      return window;
    }

    return offsetParent || getContainingBlock$1(element) || window;
  }

  function getMainAxisFromPlacement$1(placement) {
    return ['top', 'bottom'].indexOf(placement) >= 0 ? 'x' : 'y';
  }

  function within$1(min, value, max) {
    return max$2(min, min$2(value, max));
  }
  function withinMaxClamp(min, value, max) {
    var v = within$1(min, value, max);
    return v > max ? max : v;
  }

  function getFreshSideObject() {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };
  }

  function mergePaddingObject(paddingObject) {
    return Object.assign({}, getFreshSideObject(), paddingObject);
  }

  function expandToHashMap(value, keys) {
    return keys.reduce(function (hashMap, key) {
      hashMap[key] = value;
      return hashMap;
    }, {});
  }

  var toPaddingObject = function toPaddingObject(padding, state) {
    padding = typeof padding === 'function' ? padding(Object.assign({}, state.rects, {
      placement: state.placement
    })) : padding;
    return mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements));
  };

  function arrow$1(_ref) {
    var _state$modifiersData$;

    var state = _ref.state,
        name = _ref.name,
        options = _ref.options;
    var arrowElement = state.elements.arrow;
    var popperOffsets = state.modifiersData.popperOffsets;
    var basePlacement = getBasePlacement(state.placement);
    var axis = getMainAxisFromPlacement$1(basePlacement);
    var isVertical = [left, right].indexOf(basePlacement) >= 0;
    var len = isVertical ? 'height' : 'width';

    if (!arrowElement || !popperOffsets) {
      return;
    }

    var paddingObject = toPaddingObject(options.padding, state);
    var arrowRect = getLayoutRect(arrowElement);
    var minProp = axis === 'y' ? top : left;
    var maxProp = axis === 'y' ? bottom : right;
    var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets[axis] - state.rects.popper[len];
    var startDiff = popperOffsets[axis] - state.rects.reference[axis];
    var arrowOffsetParent = getOffsetParent$1(arrowElement);
    var clientSize = arrowOffsetParent ? axis === 'y' ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
    var centerToReference = endDiff / 2 - startDiff / 2; // Make sure the arrow doesn't overflow the popper if the center point is
    // outside of the popper bounds

    var min = paddingObject[minProp];
    var max = clientSize - arrowRect[len] - paddingObject[maxProp];
    var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
    var offset = within$1(min, center, max); // Prevents breaking syntax highlighting...

    var axisProp = axis;
    state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset, _state$modifiersData$.centerOffset = offset - center, _state$modifiersData$);
  }

  function effect$1(_ref2) {
    var state = _ref2.state,
        options = _ref2.options;
    var _options$element = options.element,
        arrowElement = _options$element === void 0 ? '[data-popper-arrow]' : _options$element;

    if (arrowElement == null) {
      return;
    } // CSS selector


    if (typeof arrowElement === 'string') {
      arrowElement = state.elements.popper.querySelector(arrowElement);

      if (!arrowElement) {
        return;
      }
    }

    if (!contains(state.elements.popper, arrowElement)) {

      return;
    }

    state.elements.arrow = arrowElement;
  } // eslint-disable-next-line import/no-unused-modules


  var arrow$2 = {
    name: 'arrow',
    enabled: true,
    phase: 'main',
    fn: arrow$1,
    effect: effect$1,
    requires: ['popperOffsets'],
    requiresIfExists: ['preventOverflow']
  };

  function getVariation(placement) {
    return placement.split('-')[1];
  }

  var unsetSides = {
    top: 'auto',
    right: 'auto',
    bottom: 'auto',
    left: 'auto'
  }; // Round the offsets to the nearest suitable subpixel based on the DPR.
  // Zooming can change the DPR, but it seems to report a value that will
  // cleanly divide the values into the appropriate subpixels.

  function roundOffsetsByDPR(_ref) {
    var x = _ref.x,
        y = _ref.y;
    var win = window;
    var dpr = win.devicePixelRatio || 1;
    return {
      x: round(x * dpr) / dpr || 0,
      y: round(y * dpr) / dpr || 0
    };
  }

  function mapToStyles(_ref2) {
    var _Object$assign2;

    var popper = _ref2.popper,
        popperRect = _ref2.popperRect,
        placement = _ref2.placement,
        variation = _ref2.variation,
        offsets = _ref2.offsets,
        position = _ref2.position,
        gpuAcceleration = _ref2.gpuAcceleration,
        adaptive = _ref2.adaptive,
        roundOffsets = _ref2.roundOffsets,
        isFixed = _ref2.isFixed;
    var _offsets$x = offsets.x,
        x = _offsets$x === void 0 ? 0 : _offsets$x,
        _offsets$y = offsets.y,
        y = _offsets$y === void 0 ? 0 : _offsets$y;

    var _ref3 = typeof roundOffsets === 'function' ? roundOffsets({
      x: x,
      y: y
    }) : {
      x: x,
      y: y
    };

    x = _ref3.x;
    y = _ref3.y;
    var hasX = offsets.hasOwnProperty('x');
    var hasY = offsets.hasOwnProperty('y');
    var sideX = left;
    var sideY = top;
    var win = window;

    if (adaptive) {
      var offsetParent = getOffsetParent$1(popper);
      var heightProp = 'clientHeight';
      var widthProp = 'clientWidth';

      if (offsetParent === getWindow$1(popper)) {
        offsetParent = getDocumentElement$1(popper);

        if (getComputedStyle$2(offsetParent).position !== 'static' && position === 'absolute') {
          heightProp = 'scrollHeight';
          widthProp = 'scrollWidth';
        }
      } // $FlowFixMe[incompatible-cast]: force type refinement, we compare offsetParent with window above, but Flow doesn't detect it


      offsetParent = offsetParent;

      if (placement === top || (placement === left || placement === right) && variation === end) {
        sideY = bottom;
        var offsetY = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.height : // $FlowFixMe[prop-missing]
        offsetParent[heightProp];
        y -= offsetY - popperRect.height;
        y *= gpuAcceleration ? 1 : -1;
      }

      if (placement === left || (placement === top || placement === bottom) && variation === end) {
        sideX = right;
        var offsetX = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.width : // $FlowFixMe[prop-missing]
        offsetParent[widthProp];
        x -= offsetX - popperRect.width;
        x *= gpuAcceleration ? 1 : -1;
      }
    }

    var commonStyles = Object.assign({
      position: position
    }, adaptive && unsetSides);

    var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
      x: x,
      y: y
    }) : {
      x: x,
      y: y
    };

    x = _ref4.x;
    y = _ref4.y;

    if (gpuAcceleration) {
      var _Object$assign;

      return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? '0' : '', _Object$assign[sideX] = hasX ? '0' : '', _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
    }

    return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : '', _Object$assign2[sideX] = hasX ? x + "px" : '', _Object$assign2.transform = '', _Object$assign2));
  }

  function computeStyles(_ref5) {
    var state = _ref5.state,
        options = _ref5.options;
    var _options$gpuAccelerat = options.gpuAcceleration,
        gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat,
        _options$adaptive = options.adaptive,
        adaptive = _options$adaptive === void 0 ? true : _options$adaptive,
        _options$roundOffsets = options.roundOffsets,
        roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;

    var commonStyles = {
      placement: getBasePlacement(state.placement),
      variation: getVariation(state.placement),
      popper: state.elements.popper,
      popperRect: state.rects.popper,
      gpuAcceleration: gpuAcceleration,
      isFixed: state.options.strategy === 'fixed'
    };

    if (state.modifiersData.popperOffsets != null) {
      state.styles.popper = Object.assign({}, state.styles.popper, mapToStyles(Object.assign({}, commonStyles, {
        offsets: state.modifiersData.popperOffsets,
        position: state.options.strategy,
        adaptive: adaptive,
        roundOffsets: roundOffsets
      })));
    }

    if (state.modifiersData.arrow != null) {
      state.styles.arrow = Object.assign({}, state.styles.arrow, mapToStyles(Object.assign({}, commonStyles, {
        offsets: state.modifiersData.arrow,
        position: 'absolute',
        adaptive: false,
        roundOffsets: roundOffsets
      })));
    }

    state.attributes.popper = Object.assign({}, state.attributes.popper, {
      'data-popper-placement': state.placement
    });
  } // eslint-disable-next-line import/no-unused-modules


  var computeStyles$1 = {
    name: 'computeStyles',
    enabled: true,
    phase: 'beforeWrite',
    fn: computeStyles,
    data: {}
  };

  var passive = {
    passive: true
  };

  function effect(_ref) {
    var state = _ref.state,
        instance = _ref.instance,
        options = _ref.options;
    var _options$scroll = options.scroll,
        scroll = _options$scroll === void 0 ? true : _options$scroll,
        _options$resize = options.resize,
        resize = _options$resize === void 0 ? true : _options$resize;
    var window = getWindow$1(state.elements.popper);
    var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);

    if (scroll) {
      scrollParents.forEach(function (scrollParent) {
        scrollParent.addEventListener('scroll', instance.update, passive);
      });
    }

    if (resize) {
      window.addEventListener('resize', instance.update, passive);
    }

    return function () {
      if (scroll) {
        scrollParents.forEach(function (scrollParent) {
          scrollParent.removeEventListener('scroll', instance.update, passive);
        });
      }

      if (resize) {
        window.removeEventListener('resize', instance.update, passive);
      }
    };
  } // eslint-disable-next-line import/no-unused-modules


  var eventListeners = {
    name: 'eventListeners',
    enabled: true,
    phase: 'write',
    fn: function fn() {},
    effect: effect,
    data: {}
  };

  var hash$5 = {
    left: 'right',
    right: 'left',
    bottom: 'top',
    top: 'bottom'
  };
  function getOppositePlacement$1(placement) {
    return placement.replace(/left|right|bottom|top/g, function (matched) {
      return hash$5[matched];
    });
  }

  var hash$4 = {
    start: 'end',
    end: 'start'
  };
  function getOppositeVariationPlacement(placement) {
    return placement.replace(/start|end/g, function (matched) {
      return hash$4[matched];
    });
  }

  function getWindowScroll(node) {
    var win = getWindow$1(node);
    var scrollLeft = win.pageXOffset;
    var scrollTop = win.pageYOffset;
    return {
      scrollLeft: scrollLeft,
      scrollTop: scrollTop
    };
  }

  function getWindowScrollBarX$1(element) {
    // If <html> has a CSS width greater than the viewport, then this will be
    // incorrect for RTL.
    // Popper 1 is broken in this case and never had a bug report so let's assume
    // it's not an issue. I don't think anyone ever specifies width on <html>
    // anyway.
    // Browsers where the left scrollbar doesn't cause an issue report `0` for
    // this (e.g. Edge 2019, IE11, Safari)
    return getBoundingClientRect$1(getDocumentElement$1(element)).left + getWindowScroll(element).scrollLeft;
  }

  function getViewportRect$1(element, strategy) {
    var win = getWindow$1(element);
    var html = getDocumentElement$1(element);
    var visualViewport = win.visualViewport;
    var width = html.clientWidth;
    var height = html.clientHeight;
    var x = 0;
    var y = 0;

    if (visualViewport) {
      width = visualViewport.width;
      height = visualViewport.height;
      var layoutViewport = isLayoutViewport$1();

      if (layoutViewport || !layoutViewport && strategy === 'fixed') {
        x = visualViewport.offsetLeft;
        y = visualViewport.offsetTop;
      }
    }

    return {
      width: width,
      height: height,
      x: x + getWindowScrollBarX$1(element),
      y: y
    };
  }

  // of the `<html>` and `<body>` rect bounds if horizontally scrollable

  function getDocumentRect$1(element) {
    var _element$ownerDocumen;

    var html = getDocumentElement$1(element);
    var winScroll = getWindowScroll(element);
    var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
    var width = max$2(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
    var height = max$2(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
    var x = -winScroll.scrollLeft + getWindowScrollBarX$1(element);
    var y = -winScroll.scrollTop;

    if (getComputedStyle$2(body || html).direction === 'rtl') {
      x += max$2(html.clientWidth, body ? body.clientWidth : 0) - width;
    }

    return {
      width: width,
      height: height,
      x: x,
      y: y
    };
  }

  function isScrollParent(element) {
    // Firefox wants us to check `-x` and `-y` variations as well
    var _getComputedStyle = getComputedStyle$2(element),
        overflow = _getComputedStyle.overflow,
        overflowX = _getComputedStyle.overflowX,
        overflowY = _getComputedStyle.overflowY;

    return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
  }

  function getScrollParent(node) {
    if (['html', 'body', '#document'].indexOf(getNodeName$1(node)) >= 0) {
      // $FlowFixMe[incompatible-return]: assume body is always available
      return node.ownerDocument.body;
    }

    if (isHTMLElement$2(node) && isScrollParent(node)) {
      return node;
    }

    return getScrollParent(getParentNode$1(node));
  }

  /*
  given a DOM element, return the list of all scroll parents, up the list of ancesors
  until we get to the top window object. This list is what we attach scroll listeners
  to, because if any of these parent elements scroll, we'll need to re-calculate the
  reference element's position.
  */

  function listScrollParents(element, list) {
    var _element$ownerDocumen;

    if (list === void 0) {
      list = [];
    }

    var scrollParent = getScrollParent(element);
    var isBody = scrollParent === ((_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body);
    var win = getWindow$1(scrollParent);
    var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
    var updatedList = list.concat(target);
    return isBody ? updatedList : // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
    updatedList.concat(listScrollParents(getParentNode$1(target)));
  }

  function rectToClientRect$1(rect) {
    return Object.assign({}, rect, {
      left: rect.x,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height
    });
  }

  function getInnerBoundingClientRect$1(element, strategy) {
    var rect = getBoundingClientRect$1(element, false, strategy === 'fixed');
    rect.top = rect.top + element.clientTop;
    rect.left = rect.left + element.clientLeft;
    rect.bottom = rect.top + element.clientHeight;
    rect.right = rect.left + element.clientWidth;
    rect.width = element.clientWidth;
    rect.height = element.clientHeight;
    rect.x = rect.left;
    rect.y = rect.top;
    return rect;
  }

  function getClientRectFromMixedType(element, clippingParent, strategy) {
    return clippingParent === viewport ? rectToClientRect$1(getViewportRect$1(element, strategy)) : isElement$3(clippingParent) ? getInnerBoundingClientRect$1(clippingParent, strategy) : rectToClientRect$1(getDocumentRect$1(getDocumentElement$1(element)));
  } // A "clipping parent" is an overflowable container with the characteristic of
  // clipping (or hiding) overflowing elements with a position different from
  // `initial`


  function getClippingParents(element) {
    var clippingParents = listScrollParents(getParentNode$1(element));
    var canEscapeClipping = ['absolute', 'fixed'].indexOf(getComputedStyle$2(element).position) >= 0;
    var clipperElement = canEscapeClipping && isHTMLElement$2(element) ? getOffsetParent$1(element) : element;

    if (!isElement$3(clipperElement)) {
      return [];
    } // $FlowFixMe[incompatible-return]: https://github.com/facebook/flow/issues/1414


    return clippingParents.filter(function (clippingParent) {
      return isElement$3(clippingParent) && contains(clippingParent, clipperElement) && getNodeName$1(clippingParent) !== 'body';
    });
  } // Gets the maximum area that the element is visible in due to any number of
  // clipping parents


  function getClippingRect$1(element, boundary, rootBoundary, strategy) {
    var mainClippingParents = boundary === 'clippingParents' ? getClippingParents(element) : [].concat(boundary);
    var clippingParents = [].concat(mainClippingParents, [rootBoundary]);
    var firstClippingParent = clippingParents[0];
    var clippingRect = clippingParents.reduce(function (accRect, clippingParent) {
      var rect = getClientRectFromMixedType(element, clippingParent, strategy);
      accRect.top = max$2(rect.top, accRect.top);
      accRect.right = min$2(rect.right, accRect.right);
      accRect.bottom = min$2(rect.bottom, accRect.bottom);
      accRect.left = max$2(rect.left, accRect.left);
      return accRect;
    }, getClientRectFromMixedType(element, firstClippingParent, strategy));
    clippingRect.width = clippingRect.right - clippingRect.left;
    clippingRect.height = clippingRect.bottom - clippingRect.top;
    clippingRect.x = clippingRect.left;
    clippingRect.y = clippingRect.top;
    return clippingRect;
  }

  function computeOffsets(_ref) {
    var reference = _ref.reference,
        element = _ref.element,
        placement = _ref.placement;
    var basePlacement = placement ? getBasePlacement(placement) : null;
    var variation = placement ? getVariation(placement) : null;
    var commonX = reference.x + reference.width / 2 - element.width / 2;
    var commonY = reference.y + reference.height / 2 - element.height / 2;
    var offsets;

    switch (basePlacement) {
      case top:
        offsets = {
          x: commonX,
          y: reference.y - element.height
        };
        break;

      case bottom:
        offsets = {
          x: commonX,
          y: reference.y + reference.height
        };
        break;

      case right:
        offsets = {
          x: reference.x + reference.width,
          y: commonY
        };
        break;

      case left:
        offsets = {
          x: reference.x - element.width,
          y: commonY
        };
        break;

      default:
        offsets = {
          x: reference.x,
          y: reference.y
        };
    }

    var mainAxis = basePlacement ? getMainAxisFromPlacement$1(basePlacement) : null;

    if (mainAxis != null) {
      var len = mainAxis === 'y' ? 'height' : 'width';

      switch (variation) {
        case start:
          offsets[mainAxis] = offsets[mainAxis] - (reference[len] / 2 - element[len] / 2);
          break;

        case end:
          offsets[mainAxis] = offsets[mainAxis] + (reference[len] / 2 - element[len] / 2);
          break;
      }
    }

    return offsets;
  }

  function detectOverflow$1(state, options) {
    if (options === void 0) {
      options = {};
    }

    var _options = options,
        _options$placement = _options.placement,
        placement = _options$placement === void 0 ? state.placement : _options$placement,
        _options$strategy = _options.strategy,
        strategy = _options$strategy === void 0 ? state.strategy : _options$strategy,
        _options$boundary = _options.boundary,
        boundary = _options$boundary === void 0 ? clippingParents : _options$boundary,
        _options$rootBoundary = _options.rootBoundary,
        rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary,
        _options$elementConte = _options.elementContext,
        elementContext = _options$elementConte === void 0 ? popper : _options$elementConte,
        _options$altBoundary = _options.altBoundary,
        altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary,
        _options$padding = _options.padding,
        padding = _options$padding === void 0 ? 0 : _options$padding;
    var paddingObject = mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements));
    var altContext = elementContext === popper ? reference : popper;
    var popperRect = state.rects.popper;
    var element = state.elements[altBoundary ? altContext : elementContext];
    var clippingClientRect = getClippingRect$1(isElement$3(element) ? element : element.contextElement || getDocumentElement$1(state.elements.popper), boundary, rootBoundary, strategy);
    var referenceClientRect = getBoundingClientRect$1(state.elements.reference);
    var popperOffsets = computeOffsets({
      reference: referenceClientRect,
      element: popperRect,
      strategy: 'absolute',
      placement: placement
    });
    var popperClientRect = rectToClientRect$1(Object.assign({}, popperRect, popperOffsets));
    var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect; // positive = overflowing the clipping rect
    // 0 or negative = within the clipping rect

    var overflowOffsets = {
      top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
      bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
      left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
      right: elementClientRect.right - clippingClientRect.right + paddingObject.right
    };
    var offsetData = state.modifiersData.offset; // Offsets can be applied only to the popper element

    if (elementContext === popper && offsetData) {
      var offset = offsetData[placement];
      Object.keys(overflowOffsets).forEach(function (key) {
        var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
        var axis = [top, bottom].indexOf(key) >= 0 ? 'y' : 'x';
        overflowOffsets[key] += offset[axis] * multiply;
      });
    }

    return overflowOffsets;
  }

  function computeAutoPlacement(state, options) {
    if (options === void 0) {
      options = {};
    }

    var _options = options,
        placement = _options.placement,
        boundary = _options.boundary,
        rootBoundary = _options.rootBoundary,
        padding = _options.padding,
        flipVariations = _options.flipVariations,
        _options$allowedAutoP = _options.allowedAutoPlacements,
        allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
    var variation = getVariation(placement);
    var placements$1 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function (placement) {
      return getVariation(placement) === variation;
    }) : basePlacements;
    var allowedPlacements = placements$1.filter(function (placement) {
      return allowedAutoPlacements.indexOf(placement) >= 0;
    });

    if (allowedPlacements.length === 0) {
      allowedPlacements = placements$1;
    } // $FlowFixMe[incompatible-type]: Flow seems to have problems with two array unions...


    var overflows = allowedPlacements.reduce(function (acc, placement) {
      acc[placement] = detectOverflow$1(state, {
        placement: placement,
        boundary: boundary,
        rootBoundary: rootBoundary,
        padding: padding
      })[getBasePlacement(placement)];
      return acc;
    }, {});
    return Object.keys(overflows).sort(function (a, b) {
      return overflows[a] - overflows[b];
    });
  }

  function getExpandedFallbackPlacements(placement) {
    if (getBasePlacement(placement) === auto) {
      return [];
    }

    var oppositePlacement = getOppositePlacement$1(placement);
    return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
  }

  function flip$1(_ref) {
    var state = _ref.state,
        options = _ref.options,
        name = _ref.name;

    if (state.modifiersData[name]._skip) {
      return;
    }

    var _options$mainAxis = options.mainAxis,
        checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis,
        _options$altAxis = options.altAxis,
        checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis,
        specifiedFallbackPlacements = options.fallbackPlacements,
        padding = options.padding,
        boundary = options.boundary,
        rootBoundary = options.rootBoundary,
        altBoundary = options.altBoundary,
        _options$flipVariatio = options.flipVariations,
        flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio,
        allowedAutoPlacements = options.allowedAutoPlacements;
    var preferredPlacement = state.options.placement;
    var basePlacement = getBasePlacement(preferredPlacement);
    var isBasePlacement = basePlacement === preferredPlacement;
    var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement$1(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
    var placements = [preferredPlacement].concat(fallbackPlacements).reduce(function (acc, placement) {
      return acc.concat(getBasePlacement(placement) === auto ? computeAutoPlacement(state, {
        placement: placement,
        boundary: boundary,
        rootBoundary: rootBoundary,
        padding: padding,
        flipVariations: flipVariations,
        allowedAutoPlacements: allowedAutoPlacements
      }) : placement);
    }, []);
    var referenceRect = state.rects.reference;
    var popperRect = state.rects.popper;
    var checksMap = new Map();
    var makeFallbackChecks = true;
    var firstFittingPlacement = placements[0];

    for (var i = 0; i < placements.length; i++) {
      var placement = placements[i];

      var _basePlacement = getBasePlacement(placement);

      var isStartVariation = getVariation(placement) === start;
      var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
      var len = isVertical ? 'width' : 'height';
      var overflow = detectOverflow$1(state, {
        placement: placement,
        boundary: boundary,
        rootBoundary: rootBoundary,
        altBoundary: altBoundary,
        padding: padding
      });
      var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;

      if (referenceRect[len] > popperRect[len]) {
        mainVariationSide = getOppositePlacement$1(mainVariationSide);
      }

      var altVariationSide = getOppositePlacement$1(mainVariationSide);
      var checks = [];

      if (checkMainAxis) {
        checks.push(overflow[_basePlacement] <= 0);
      }

      if (checkAltAxis) {
        checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
      }

      if (checks.every(function (check) {
        return check;
      })) {
        firstFittingPlacement = placement;
        makeFallbackChecks = false;
        break;
      }

      checksMap.set(placement, checks);
    }

    if (makeFallbackChecks) {
      // `2` may be desired in some cases – research later
      var numberOfChecks = flipVariations ? 3 : 1;

      var _loop = function _loop(_i) {
        var fittingPlacement = placements.find(function (placement) {
          var checks = checksMap.get(placement);

          if (checks) {
            return checks.slice(0, _i).every(function (check) {
              return check;
            });
          }
        });

        if (fittingPlacement) {
          firstFittingPlacement = fittingPlacement;
          return "break";
        }
      };

      for (var _i = numberOfChecks; _i > 0; _i--) {
        var _ret = _loop(_i);

        if (_ret === "break") break;
      }
    }

    if (state.placement !== firstFittingPlacement) {
      state.modifiersData[name]._skip = true;
      state.placement = firstFittingPlacement;
      state.reset = true;
    }
  } // eslint-disable-next-line import/no-unused-modules


  var flip$2 = {
    name: 'flip',
    enabled: true,
    phase: 'main',
    fn: flip$1,
    requiresIfExists: ['offset'],
    data: {
      _skip: false
    }
  };

  function getSideOffsets(overflow, rect, preventedOffsets) {
    if (preventedOffsets === void 0) {
      preventedOffsets = {
        x: 0,
        y: 0
      };
    }

    return {
      top: overflow.top - rect.height - preventedOffsets.y,
      right: overflow.right - rect.width + preventedOffsets.x,
      bottom: overflow.bottom - rect.height + preventedOffsets.y,
      left: overflow.left - rect.width - preventedOffsets.x
    };
  }

  function isAnySideFullyClipped(overflow) {
    return [top, right, bottom, left].some(function (side) {
      return overflow[side] >= 0;
    });
  }

  function hide(_ref) {
    var state = _ref.state,
        name = _ref.name;
    var referenceRect = state.rects.reference;
    var popperRect = state.rects.popper;
    var preventedOffsets = state.modifiersData.preventOverflow;
    var referenceOverflow = detectOverflow$1(state, {
      elementContext: 'reference'
    });
    var popperAltOverflow = detectOverflow$1(state, {
      altBoundary: true
    });
    var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
    var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
    var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
    var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
    state.modifiersData[name] = {
      referenceClippingOffsets: referenceClippingOffsets,
      popperEscapeOffsets: popperEscapeOffsets,
      isReferenceHidden: isReferenceHidden,
      hasPopperEscaped: hasPopperEscaped
    };
    state.attributes.popper = Object.assign({}, state.attributes.popper, {
      'data-popper-reference-hidden': isReferenceHidden,
      'data-popper-escaped': hasPopperEscaped
    });
  } // eslint-disable-next-line import/no-unused-modules


  var hide$1 = {
    name: 'hide',
    enabled: true,
    phase: 'main',
    requiresIfExists: ['preventOverflow'],
    fn: hide
  };

  function distanceAndSkiddingToXY(placement, rects, offset) {
    var basePlacement = getBasePlacement(placement);
    var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;

    var _ref = typeof offset === 'function' ? offset(Object.assign({}, rects, {
      placement: placement
    })) : offset,
        skidding = _ref[0],
        distance = _ref[1];

    skidding = skidding || 0;
    distance = (distance || 0) * invertDistance;
    return [left, right].indexOf(basePlacement) >= 0 ? {
      x: distance,
      y: skidding
    } : {
      x: skidding,
      y: distance
    };
  }

  function offset(_ref2) {
    var state = _ref2.state,
        options = _ref2.options,
        name = _ref2.name;
    var _options$offset = options.offset,
        offset = _options$offset === void 0 ? [0, 0] : _options$offset;
    var data = placements.reduce(function (acc, placement) {
      acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset);
      return acc;
    }, {});
    var _data$state$placement = data[state.placement],
        x = _data$state$placement.x,
        y = _data$state$placement.y;

    if (state.modifiersData.popperOffsets != null) {
      state.modifiersData.popperOffsets.x += x;
      state.modifiersData.popperOffsets.y += y;
    }

    state.modifiersData[name] = data;
  } // eslint-disable-next-line import/no-unused-modules


  var offset$1 = {
    name: 'offset',
    enabled: true,
    phase: 'main',
    requires: ['popperOffsets'],
    fn: offset
  };

  function popperOffsets(_ref) {
    var state = _ref.state,
        name = _ref.name;
    // Offsets are the actual position the popper needs to have to be
    // properly positioned near its reference element
    // This is the most basic placement, and will be adjusted by
    // the modifiers in the next step
    state.modifiersData[name] = computeOffsets({
      reference: state.rects.reference,
      element: state.rects.popper,
      strategy: 'absolute',
      placement: state.placement
    });
  } // eslint-disable-next-line import/no-unused-modules


  var popperOffsets$1 = {
    name: 'popperOffsets',
    enabled: true,
    phase: 'read',
    fn: popperOffsets,
    data: {}
  };

  function getAltAxis(axis) {
    return axis === 'x' ? 'y' : 'x';
  }

  function preventOverflow(_ref) {
    var state = _ref.state,
        options = _ref.options,
        name = _ref.name;
    var _options$mainAxis = options.mainAxis,
        checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis,
        _options$altAxis = options.altAxis,
        checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis,
        boundary = options.boundary,
        rootBoundary = options.rootBoundary,
        altBoundary = options.altBoundary,
        padding = options.padding,
        _options$tether = options.tether,
        tether = _options$tether === void 0 ? true : _options$tether,
        _options$tetherOffset = options.tetherOffset,
        tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
    var overflow = detectOverflow$1(state, {
      boundary: boundary,
      rootBoundary: rootBoundary,
      padding: padding,
      altBoundary: altBoundary
    });
    var basePlacement = getBasePlacement(state.placement);
    var variation = getVariation(state.placement);
    var isBasePlacement = !variation;
    var mainAxis = getMainAxisFromPlacement$1(basePlacement);
    var altAxis = getAltAxis(mainAxis);
    var popperOffsets = state.modifiersData.popperOffsets;
    var referenceRect = state.rects.reference;
    var popperRect = state.rects.popper;
    var tetherOffsetValue = typeof tetherOffset === 'function' ? tetherOffset(Object.assign({}, state.rects, {
      placement: state.placement
    })) : tetherOffset;
    var normalizedTetherOffsetValue = typeof tetherOffsetValue === 'number' ? {
      mainAxis: tetherOffsetValue,
      altAxis: tetherOffsetValue
    } : Object.assign({
      mainAxis: 0,
      altAxis: 0
    }, tetherOffsetValue);
    var offsetModifierState = state.modifiersData.offset ? state.modifiersData.offset[state.placement] : null;
    var data = {
      x: 0,
      y: 0
    };

    if (!popperOffsets) {
      return;
    }

    if (checkMainAxis) {
      var _offsetModifierState$;

      var mainSide = mainAxis === 'y' ? top : left;
      var altSide = mainAxis === 'y' ? bottom : right;
      var len = mainAxis === 'y' ? 'height' : 'width';
      var offset = popperOffsets[mainAxis];
      var min = offset + overflow[mainSide];
      var max = offset - overflow[altSide];
      var additive = tether ? -popperRect[len] / 2 : 0;
      var minLen = variation === start ? referenceRect[len] : popperRect[len];
      var maxLen = variation === start ? -popperRect[len] : -referenceRect[len]; // We need to include the arrow in the calculation so the arrow doesn't go
      // outside the reference bounds

      var arrowElement = state.elements.arrow;
      var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
        width: 0,
        height: 0
      };
      var arrowPaddingObject = state.modifiersData['arrow#persistent'] ? state.modifiersData['arrow#persistent'].padding : getFreshSideObject();
      var arrowPaddingMin = arrowPaddingObject[mainSide];
      var arrowPaddingMax = arrowPaddingObject[altSide]; // If the reference length is smaller than the arrow length, we don't want
      // to include its full size in the calculation. If the reference is small
      // and near the edge of a boundary, the popper can overflow even if the
      // reference is not overflowing as well (e.g. virtual elements with no
      // width or height)

      var arrowLen = within$1(0, referenceRect[len], arrowRect[len]);
      var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis : minLen - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis;
      var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis : maxLen + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis;
      var arrowOffsetParent = state.elements.arrow && getOffsetParent$1(state.elements.arrow);
      var clientOffset = arrowOffsetParent ? mainAxis === 'y' ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
      var offsetModifierValue = (_offsetModifierState$ = offsetModifierState == null ? void 0 : offsetModifierState[mainAxis]) != null ? _offsetModifierState$ : 0;
      var tetherMin = offset + minOffset - offsetModifierValue - clientOffset;
      var tetherMax = offset + maxOffset - offsetModifierValue;
      var preventedOffset = within$1(tether ? min$2(min, tetherMin) : min, offset, tether ? max$2(max, tetherMax) : max);
      popperOffsets[mainAxis] = preventedOffset;
      data[mainAxis] = preventedOffset - offset;
    }

    if (checkAltAxis) {
      var _offsetModifierState$2;

      var _mainSide = mainAxis === 'x' ? top : left;

      var _altSide = mainAxis === 'x' ? bottom : right;

      var _offset = popperOffsets[altAxis];

      var _len = altAxis === 'y' ? 'height' : 'width';

      var _min = _offset + overflow[_mainSide];

      var _max = _offset - overflow[_altSide];

      var isOriginSide = [top, left].indexOf(basePlacement) !== -1;

      var _offsetModifierValue = (_offsetModifierState$2 = offsetModifierState == null ? void 0 : offsetModifierState[altAxis]) != null ? _offsetModifierState$2 : 0;

      var _tetherMin = isOriginSide ? _min : _offset - referenceRect[_len] - popperRect[_len] - _offsetModifierValue + normalizedTetherOffsetValue.altAxis;

      var _tetherMax = isOriginSide ? _offset + referenceRect[_len] + popperRect[_len] - _offsetModifierValue - normalizedTetherOffsetValue.altAxis : _max;

      var _preventedOffset = tether && isOriginSide ? withinMaxClamp(_tetherMin, _offset, _tetherMax) : within$1(tether ? _tetherMin : _min, _offset, tether ? _tetherMax : _max);

      popperOffsets[altAxis] = _preventedOffset;
      data[altAxis] = _preventedOffset - _offset;
    }

    state.modifiersData[name] = data;
  } // eslint-disable-next-line import/no-unused-modules


  var preventOverflow$1 = {
    name: 'preventOverflow',
    enabled: true,
    phase: 'main',
    fn: preventOverflow,
    requiresIfExists: ['offset']
  };

  function getHTMLElementScroll(element) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }

  function getNodeScroll$1(node) {
    if (node === getWindow$1(node) || !isHTMLElement$2(node)) {
      return getWindowScroll(node);
    } else {
      return getHTMLElementScroll(node);
    }
  }

  function isElementScaled(element) {
    var rect = element.getBoundingClientRect();
    var scaleX = round(rect.width) / element.offsetWidth || 1;
    var scaleY = round(rect.height) / element.offsetHeight || 1;
    return scaleX !== 1 || scaleY !== 1;
  } // Returns the composite rect of an element relative to its offsetParent.
  // Composite means it takes into account transforms as well as layout.


  function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
    if (isFixed === void 0) {
      isFixed = false;
    }

    var isOffsetParentAnElement = isHTMLElement$2(offsetParent);
    var offsetParentIsScaled = isHTMLElement$2(offsetParent) && isElementScaled(offsetParent);
    var documentElement = getDocumentElement$1(offsetParent);
    var rect = getBoundingClientRect$1(elementOrVirtualElement, offsetParentIsScaled, isFixed);
    var scroll = {
      scrollLeft: 0,
      scrollTop: 0
    };
    var offsets = {
      x: 0,
      y: 0
    };

    if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
      if (getNodeName$1(offsetParent) !== 'body' || // https://github.com/popperjs/popper-core/issues/1078
      isScrollParent(documentElement)) {
        scroll = getNodeScroll$1(offsetParent);
      }

      if (isHTMLElement$2(offsetParent)) {
        offsets = getBoundingClientRect$1(offsetParent, true);
        offsets.x += offsetParent.clientLeft;
        offsets.y += offsetParent.clientTop;
      } else if (documentElement) {
        offsets.x = getWindowScrollBarX$1(documentElement);
      }
    }

    return {
      x: rect.left + scroll.scrollLeft - offsets.x,
      y: rect.top + scroll.scrollTop - offsets.y,
      width: rect.width,
      height: rect.height
    };
  }

  function order(modifiers) {
    var map = new Map();
    var visited = new Set();
    var result = [];
    modifiers.forEach(function (modifier) {
      map.set(modifier.name, modifier);
    }); // On visiting object, check for its dependencies and visit them recursively

    function sort(modifier) {
      visited.add(modifier.name);
      var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
      requires.forEach(function (dep) {
        if (!visited.has(dep)) {
          var depModifier = map.get(dep);

          if (depModifier) {
            sort(depModifier);
          }
        }
      });
      result.push(modifier);
    }

    modifiers.forEach(function (modifier) {
      if (!visited.has(modifier.name)) {
        // check for visited object
        sort(modifier);
      }
    });
    return result;
  }

  function orderModifiers(modifiers) {
    // order based on dependencies
    var orderedModifiers = order(modifiers); // order based on phase

    return modifierPhases.reduce(function (acc, phase) {
      return acc.concat(orderedModifiers.filter(function (modifier) {
        return modifier.phase === phase;
      }));
    }, []);
  }

  function debounce(fn) {
    var pending;
    return function () {
      if (!pending) {
        pending = new Promise(function (resolve) {
          Promise.resolve().then(function () {
            pending = undefined;
            resolve(fn());
          });
        });
      }

      return pending;
    };
  }

  function mergeByName(modifiers) {
    var merged = modifiers.reduce(function (merged, current) {
      var existing = merged[current.name];
      merged[current.name] = existing ? Object.assign({}, existing, current, {
        options: Object.assign({}, existing.options, current.options),
        data: Object.assign({}, existing.data, current.data)
      }) : current;
      return merged;
    }, {}); // IE11 does not support Object.values

    return Object.keys(merged).map(function (key) {
      return merged[key];
    });
  }

  var DEFAULT_OPTIONS = {
    placement: 'bottom',
    modifiers: [],
    strategy: 'absolute'
  };

  function areValidElements() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return !args.some(function (element) {
      return !(element && typeof element.getBoundingClientRect === 'function');
    });
  }

  function popperGenerator(generatorOptions) {
    if (generatorOptions === void 0) {
      generatorOptions = {};
    }

    var _generatorOptions = generatorOptions,
        _generatorOptions$def = _generatorOptions.defaultModifiers,
        defaultModifiers = _generatorOptions$def === void 0 ? [] : _generatorOptions$def,
        _generatorOptions$def2 = _generatorOptions.defaultOptions,
        defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
    return function createPopper(reference, popper, options) {
      if (options === void 0) {
        options = defaultOptions;
      }

      var state = {
        placement: 'bottom',
        orderedModifiers: [],
        options: Object.assign({}, DEFAULT_OPTIONS, defaultOptions),
        modifiersData: {},
        elements: {
          reference: reference,
          popper: popper
        },
        attributes: {},
        styles: {}
      };
      var effectCleanupFns = [];
      var isDestroyed = false;
      var instance = {
        state: state,
        setOptions: function setOptions(setOptionsAction) {
          var options = typeof setOptionsAction === 'function' ? setOptionsAction(state.options) : setOptionsAction;
          cleanupModifierEffects();
          state.options = Object.assign({}, defaultOptions, state.options, options);
          state.scrollParents = {
            reference: isElement$3(reference) ? listScrollParents(reference) : reference.contextElement ? listScrollParents(reference.contextElement) : [],
            popper: listScrollParents(popper)
          }; // Orders the modifiers based on their dependencies and `phase`
          // properties

          var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers, state.options.modifiers))); // Strip out disabled modifiers

          state.orderedModifiers = orderedModifiers.filter(function (m) {
            return m.enabled;
          }); // Validate the provided modifiers so that the consumer will get warned

          runModifierEffects();
          return instance.update();
        },
        // Sync update – it will always be executed, even if not necessary. This
        // is useful for low frequency updates where sync behavior simplifies the
        // logic.
        // For high frequency updates (e.g. `resize` and `scroll` events), always
        // prefer the async Popper#update method
        forceUpdate: function forceUpdate() {
          if (isDestroyed) {
            return;
          }

          var _state$elements = state.elements,
              reference = _state$elements.reference,
              popper = _state$elements.popper; // Don't proceed if `reference` or `popper` are not valid elements
          // anymore

          if (!areValidElements(reference, popper)) {

            return;
          } // Store the reference and popper rects to be read by modifiers


          state.rects = {
            reference: getCompositeRect(reference, getOffsetParent$1(popper), state.options.strategy === 'fixed'),
            popper: getLayoutRect(popper)
          }; // Modifiers have the ability to reset the current update cycle. The
          // most common use case for this is the `flip` modifier changing the
          // placement, which then needs to re-run all the modifiers, because the
          // logic was previously ran for the previous placement and is therefore
          // stale/incorrect

          state.reset = false;
          state.placement = state.options.placement; // On each update cycle, the `modifiersData` property for each modifier
          // is filled with the initial data specified by the modifier. This means
          // it doesn't persist and is fresh on each update.
          // To ensure persistent data, use `${name}#persistent`

          state.orderedModifiers.forEach(function (modifier) {
            return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
          });

          for (var index = 0; index < state.orderedModifiers.length; index++) {

            if (state.reset === true) {
              state.reset = false;
              index = -1;
              continue;
            }

            var _state$orderedModifie = state.orderedModifiers[index],
                fn = _state$orderedModifie.fn,
                _state$orderedModifie2 = _state$orderedModifie.options,
                _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2,
                name = _state$orderedModifie.name;

            if (typeof fn === 'function') {
              state = fn({
                state: state,
                options: _options,
                name: name,
                instance: instance
              }) || state;
            }
          }
        },
        // Async and optimistically optimized update – it will not be executed if
        // not necessary (debounced to run at most once-per-tick)
        update: debounce(function () {
          return new Promise(function (resolve) {
            instance.forceUpdate();
            resolve(state);
          });
        }),
        destroy: function destroy() {
          cleanupModifierEffects();
          isDestroyed = true;
        }
      };

      if (!areValidElements(reference, popper)) {

        return instance;
      }

      instance.setOptions(options).then(function (state) {
        if (!isDestroyed && options.onFirstUpdate) {
          options.onFirstUpdate(state);
        }
      }); // Modifiers have the ability to execute arbitrary code before the first
      // update cycle runs. They will be executed in the same order as the update
      // cycle. This is useful when a modifier adds some persistent data that
      // other modifiers need to use, but the modifier is run after the dependent
      // one.

      function runModifierEffects() {
        state.orderedModifiers.forEach(function (_ref3) {
          var name = _ref3.name,
              _ref3$options = _ref3.options,
              options = _ref3$options === void 0 ? {} : _ref3$options,
              effect = _ref3.effect;

          if (typeof effect === 'function') {
            var cleanupFn = effect({
              state: state,
              name: name,
              instance: instance,
              options: options
            });

            var noopFn = function noopFn() {};

            effectCleanupFns.push(cleanupFn || noopFn);
          }
        });
      }

      function cleanupModifierEffects() {
        effectCleanupFns.forEach(function (fn) {
          return fn();
        });
        effectCleanupFns = [];
      }

      return instance;
    };
  }
  var createPopper$2 = /*#__PURE__*/popperGenerator(); // eslint-disable-next-line import/no-unused-modules

  var defaultModifiers$1 = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1];
  var createPopper$1 = /*#__PURE__*/popperGenerator({
    defaultModifiers: defaultModifiers$1
  }); // eslint-disable-next-line import/no-unused-modules

  var defaultModifiers = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1, offset$1, flip$2, preventOverflow$1, arrow$2, hide$1];
  var createPopper = /*#__PURE__*/popperGenerator({
    defaultModifiers: defaultModifiers
  }); // eslint-disable-next-line import/no-unused-modules

  var Popper = /*#__PURE__*/Object.freeze({
    __proto__: null,
    popperGenerator: popperGenerator,
    detectOverflow: detectOverflow$1,
    createPopperBase: createPopper$2,
    createPopper: createPopper,
    createPopperLite: createPopper$1,
    top: top,
    bottom: bottom,
    right: right,
    left: left,
    auto: auto,
    basePlacements: basePlacements,
    start: start,
    end: end,
    clippingParents: clippingParents,
    viewport: viewport,
    popper: popper,
    reference: reference,
    variationPlacements: variationPlacements,
    placements: placements,
    beforeRead: beforeRead,
    read: read,
    afterRead: afterRead,
    beforeMain: beforeMain,
    main: main,
    afterMain: afterMain,
    beforeWrite: beforeWrite,
    write: write,
    afterWrite: afterWrite,
    modifierPhases: modifierPhases,
    applyStyles: applyStyles$1,
    arrow: arrow$2,
    computeStyles: computeStyles$1,
    eventListeners: eventListeners,
    flip: flip$2,
    hide: hide$1,
    offset: offset$1,
    popperOffsets: popperOffsets$1,
    preventOverflow: preventOverflow$1
  });

  /*!
    * Bootstrap v5.3.0-alpha1 (https://getbootstrap.com/)
    * Copyright 2011-2022 The Bootstrap Authors (https://github.com/twbs/bootstrap/graphs/contributors)
    * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
    */

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/index.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  const MAX_UID = 1000000;
  const MILLISECONDS_MULTIPLIER = 1000;
  const TRANSITION_END = 'transitionend';

  /**
   * Properly escape IDs selectors to handle weird IDs
   * @param {string} selector
   * @returns {string}
   */
  const parseSelector = selector => {
    if (selector && window.CSS && window.CSS.escape) {
      // document.querySelector needs escaping to handle IDs (html5+) containing for instance /
      selector = selector.replace(/#([^\s"#']+)/g, (match, id) => `#${CSS.escape(id)}`);
    }
    return selector;
  };

  // Shout-out Angus Croll (https://goo.gl/pxwQGp)
  const toType = object => {
    if (object === null || object === undefined) {
      return `${object}`;
    }
    return Object.prototype.toString.call(object).match(/\s([a-z]+)/i)[1].toLowerCase();
  };

  /**
   * Public Util API
   */

  const getUID = prefix => {
    do {
      prefix += Math.floor(Math.random() * MAX_UID);
    } while (document.getElementById(prefix));
    return prefix;
  };
  const getTransitionDurationFromElement = element => {
    if (!element) {
      return 0;
    }

    // Get transition-duration of the element
    let {
      transitionDuration,
      transitionDelay
    } = window.getComputedStyle(element);
    const floatTransitionDuration = Number.parseFloat(transitionDuration);
    const floatTransitionDelay = Number.parseFloat(transitionDelay);

    // Return 0 if element or transition duration is not found
    if (!floatTransitionDuration && !floatTransitionDelay) {
      return 0;
    }

    // If multiple durations are defined, take the first
    transitionDuration = transitionDuration.split(',')[0];
    transitionDelay = transitionDelay.split(',')[0];
    return (Number.parseFloat(transitionDuration) + Number.parseFloat(transitionDelay)) * MILLISECONDS_MULTIPLIER;
  };
  const triggerTransitionEnd = element => {
    element.dispatchEvent(new Event(TRANSITION_END));
  };
  const isElement$2 = object => {
    if (!object || typeof object !== 'object') {
      return false;
    }
    if (typeof object.jquery !== 'undefined') {
      object = object[0];
    }
    return typeof object.nodeType !== 'undefined';
  };
  const getElement = object => {
    // it's a jQuery object or a node element
    if (isElement$2(object)) {
      return object.jquery ? object[0] : object;
    }
    if (typeof object === 'string' && object.length > 0) {
      return document.querySelector(parseSelector(object));
    }
    return null;
  };
  const isVisible = element => {
    if (!isElement$2(element) || element.getClientRects().length === 0) {
      return false;
    }
    const elementIsVisible = getComputedStyle(element).getPropertyValue('visibility') === 'visible';
    // Handle `details` element as its content may falsie appear visible when it is closed
    const closedDetails = element.closest('details:not([open])');
    if (!closedDetails) {
      return elementIsVisible;
    }
    if (closedDetails !== element) {
      const summary = element.closest('summary');
      if (summary && summary.parentNode !== closedDetails) {
        return false;
      }
      if (summary === null) {
        return false;
      }
    }
    return elementIsVisible;
  };
  const isDisabled = element => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }
    if (element.classList.contains('disabled')) {
      return true;
    }
    if (typeof element.disabled !== 'undefined') {
      return element.disabled;
    }
    return element.hasAttribute('disabled') && element.getAttribute('disabled') !== 'false';
  };
  const findShadowRoot = element => {
    if (!document.documentElement.attachShadow) {
      return null;
    }

    // Can find the shadow root otherwise it'll return the document
    if (typeof element.getRootNode === 'function') {
      const root = element.getRootNode();
      return root instanceof ShadowRoot ? root : null;
    }
    if (element instanceof ShadowRoot) {
      return element;
    }

    // when we don't find a shadow root
    if (!element.parentNode) {
      return null;
    }
    return findShadowRoot(element.parentNode);
  };
  const noop$1 = () => {};

  /**
   * Trick to restart an element's animation
   *
   * @param {HTMLElement} element
   * @return void
   *
   * @see https://www.charistheo.io/blog/2021/02/restart-a-css-animation-with-javascript/#restarting-a-css-animation
   */
  const reflow = element => {
    element.offsetHeight; // eslint-disable-line no-unused-expressions
  };

  const getjQuery = () => {
    if (window.jQuery && !document.body.hasAttribute('data-bs-no-jquery')) {
      return window.jQuery;
    }
    return null;
  };
  const DOMContentLoadedCallbacks = [];
  const onDOMContentLoaded = callback => {
    if (document.readyState === 'loading') {
      // add listener on the first call when the document is in loading state
      if (!DOMContentLoadedCallbacks.length) {
        document.addEventListener('DOMContentLoaded', () => {
          for (const callback of DOMContentLoadedCallbacks) {
            callback();
          }
        });
      }
      DOMContentLoadedCallbacks.push(callback);
    } else {
      callback();
    }
  };
  const isRTL = () => document.documentElement.dir === 'rtl';
  const defineJQueryPlugin = plugin => {
    onDOMContentLoaded(() => {
      const $ = getjQuery();
      /* istanbul ignore if */
      if ($) {
        const name = plugin.NAME;
        const JQUERY_NO_CONFLICT = $.fn[name];
        $.fn[name] = plugin.jQueryInterface;
        $.fn[name].Constructor = plugin;
        $.fn[name].noConflict = () => {
          $.fn[name] = JQUERY_NO_CONFLICT;
          return plugin.jQueryInterface;
        };
      }
    });
  };
  const execute = (possibleCallback, args = [], defaultValue = possibleCallback) => {
    return typeof possibleCallback === 'function' ? possibleCallback(...args) : defaultValue;
  };
  const executeAfterTransition = (callback, transitionElement, waitForTransition = true) => {
    if (!waitForTransition) {
      execute(callback);
      return;
    }
    const durationPadding = 5;
    const emulatedDuration = getTransitionDurationFromElement(transitionElement) + durationPadding;
    let called = false;
    const handler = ({
      target
    }) => {
      if (target !== transitionElement) {
        return;
      }
      called = true;
      transitionElement.removeEventListener(TRANSITION_END, handler);
      execute(callback);
    };
    transitionElement.addEventListener(TRANSITION_END, handler);
    setTimeout(() => {
      if (!called) {
        triggerTransitionEnd(transitionElement);
      }
    }, emulatedDuration);
  };

  /**
   * Return the previous/next element of a list.
   *
   * @param {array} list    The list of elements
   * @param activeElement   The active element
   * @param shouldGetNext   Choose to get next or previous element
   * @param isCycleAllowed
   * @return {Element|elem} The proper element
   */
  const getNextActiveElement = (list, activeElement, shouldGetNext, isCycleAllowed) => {
    const listLength = list.length;
    let index = list.indexOf(activeElement);

    // if the element does not exist in the list return an element
    // depending on the direction and if cycle is allowed
    if (index === -1) {
      return !shouldGetNext && isCycleAllowed ? list[listLength - 1] : list[0];
    }
    index += shouldGetNext ? 1 : -1;
    if (isCycleAllowed) {
      index = (index + listLength) % listLength;
    }
    return list[Math.max(0, Math.min(index, listLength - 1))];
  };

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): dom/event-handler.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const namespaceRegex = /[^.]*(?=\..*)\.|.*/;
  const stripNameRegex = /\..*/;
  const stripUidRegex = /::\d+$/;
  const eventRegistry = {}; // Events storage
  let uidEvent = 1;
  const customEvents = {
    mouseenter: 'mouseover',
    mouseleave: 'mouseout'
  };
  const nativeEvents = new Set(['click', 'dblclick', 'mouseup', 'mousedown', 'contextmenu', 'mousewheel', 'DOMMouseScroll', 'mouseover', 'mouseout', 'mousemove', 'selectstart', 'selectend', 'keydown', 'keypress', 'keyup', 'orientationchange', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointermove', 'pointerup', 'pointerleave', 'pointercancel', 'gesturestart', 'gesturechange', 'gestureend', 'focus', 'blur', 'change', 'reset', 'select', 'submit', 'focusin', 'focusout', 'load', 'unload', 'beforeunload', 'resize', 'move', 'DOMContentLoaded', 'readystatechange', 'error', 'abort', 'scroll']);

  /**
   * Private methods
   */

  function makeEventUid(element, uid) {
    return uid && `${uid}::${uidEvent++}` || element.uidEvent || uidEvent++;
  }
  function getElementEvents(element) {
    const uid = makeEventUid(element);
    element.uidEvent = uid;
    eventRegistry[uid] = eventRegistry[uid] || {};
    return eventRegistry[uid];
  }
  function bootstrapHandler(element, fn) {
    return function handler(event) {
      hydrateObj(event, {
        delegateTarget: element
      });
      if (handler.oneOff) {
        EventHandler.off(element, event.type, fn);
      }
      return fn.apply(element, [event]);
    };
  }
  function bootstrapDelegationHandler(element, selector, fn) {
    return function handler(event) {
      const domElements = element.querySelectorAll(selector);
      for (let {
        target
      } = event; target && target !== this; target = target.parentNode) {
        for (const domElement of domElements) {
          if (domElement !== target) {
            continue;
          }
          hydrateObj(event, {
            delegateTarget: target
          });
          if (handler.oneOff) {
            EventHandler.off(element, event.type, selector, fn);
          }
          return fn.apply(target, [event]);
        }
      }
    };
  }
  function findHandler(events, callable, delegationSelector = null) {
    return Object.values(events).find(event => event.callable === callable && event.delegationSelector === delegationSelector);
  }
  function normalizeParameters(originalTypeEvent, handler, delegationFunction) {
    const isDelegated = typeof handler === 'string';
    // todo: tooltip passes `false` instead of selector, so we need to check
    const callable = isDelegated ? delegationFunction : handler || delegationFunction;
    let typeEvent = getTypeEvent(originalTypeEvent);
    if (!nativeEvents.has(typeEvent)) {
      typeEvent = originalTypeEvent;
    }
    return [isDelegated, callable, typeEvent];
  }
  function addHandler(element, originalTypeEvent, handler, delegationFunction, oneOff) {
    if (typeof originalTypeEvent !== 'string' || !element) {
      return;
    }
    let [isDelegated, callable, typeEvent] = normalizeParameters(originalTypeEvent, handler, delegationFunction);

    // in case of mouseenter or mouseleave wrap the handler within a function that checks for its DOM position
    // this prevents the handler from being dispatched the same way as mouseover or mouseout does
    if (originalTypeEvent in customEvents) {
      const wrapFunction = fn => {
        return function (event) {
          if (!event.relatedTarget || event.relatedTarget !== event.delegateTarget && !event.delegateTarget.contains(event.relatedTarget)) {
            return fn.call(this, event);
          }
        };
      };
      callable = wrapFunction(callable);
    }
    const events = getElementEvents(element);
    const handlers = events[typeEvent] || (events[typeEvent] = {});
    const previousFunction = findHandler(handlers, callable, isDelegated ? handler : null);
    if (previousFunction) {
      previousFunction.oneOff = previousFunction.oneOff && oneOff;
      return;
    }
    const uid = makeEventUid(callable, originalTypeEvent.replace(namespaceRegex, ''));
    const fn = isDelegated ? bootstrapDelegationHandler(element, handler, callable) : bootstrapHandler(element, callable);
    fn.delegationSelector = isDelegated ? handler : null;
    fn.callable = callable;
    fn.oneOff = oneOff;
    fn.uidEvent = uid;
    handlers[uid] = fn;
    element.addEventListener(typeEvent, fn, isDelegated);
  }
  function removeHandler(element, events, typeEvent, handler, delegationSelector) {
    const fn = findHandler(events[typeEvent], handler, delegationSelector);
    if (!fn) {
      return;
    }
    element.removeEventListener(typeEvent, fn, Boolean(delegationSelector));
    delete events[typeEvent][fn.uidEvent];
  }
  function removeNamespacedHandlers(element, events, typeEvent, namespace) {
    const storeElementEvent = events[typeEvent] || {};
    for (const [handlerKey, event] of Object.entries(storeElementEvent)) {
      if (handlerKey.includes(namespace)) {
        removeHandler(element, events, typeEvent, event.callable, event.delegationSelector);
      }
    }
  }
  function getTypeEvent(event) {
    // allow to get the native events from namespaced events ('click.bs.button' --> 'click')
    event = event.replace(stripNameRegex, '');
    return customEvents[event] || event;
  }
  const EventHandler = {
    on(element, event, handler, delegationFunction) {
      addHandler(element, event, handler, delegationFunction, false);
    },
    one(element, event, handler, delegationFunction) {
      addHandler(element, event, handler, delegationFunction, true);
    },
    off(element, originalTypeEvent, handler, delegationFunction) {
      if (typeof originalTypeEvent !== 'string' || !element) {
        return;
      }
      const [isDelegated, callable, typeEvent] = normalizeParameters(originalTypeEvent, handler, delegationFunction);
      const inNamespace = typeEvent !== originalTypeEvent;
      const events = getElementEvents(element);
      const storeElementEvent = events[typeEvent] || {};
      const isNamespace = originalTypeEvent.startsWith('.');
      if (typeof callable !== 'undefined') {
        // Simplest case: handler is passed, remove that listener ONLY.
        if (!Object.keys(storeElementEvent).length) {
          return;
        }
        removeHandler(element, events, typeEvent, callable, isDelegated ? handler : null);
        return;
      }
      if (isNamespace) {
        for (const elementEvent of Object.keys(events)) {
          removeNamespacedHandlers(element, events, elementEvent, originalTypeEvent.slice(1));
        }
      }
      for (const [keyHandlers, event] of Object.entries(storeElementEvent)) {
        const handlerKey = keyHandlers.replace(stripUidRegex, '');
        if (!inNamespace || originalTypeEvent.includes(handlerKey)) {
          removeHandler(element, events, typeEvent, event.callable, event.delegationSelector);
        }
      }
    },
    trigger(element, event, args) {
      if (typeof event !== 'string' || !element) {
        return null;
      }
      const $ = getjQuery();
      const typeEvent = getTypeEvent(event);
      const inNamespace = event !== typeEvent;
      let jQueryEvent = null;
      let bubbles = true;
      let nativeDispatch = true;
      let defaultPrevented = false;
      if (inNamespace && $) {
        jQueryEvent = $.Event(event, args);
        $(element).trigger(jQueryEvent);
        bubbles = !jQueryEvent.isPropagationStopped();
        nativeDispatch = !jQueryEvent.isImmediatePropagationStopped();
        defaultPrevented = jQueryEvent.isDefaultPrevented();
      }
      let evt = new Event(event, {
        bubbles,
        cancelable: true
      });
      evt = hydrateObj(evt, args);
      if (defaultPrevented) {
        evt.preventDefault();
      }
      if (nativeDispatch) {
        element.dispatchEvent(evt);
      }
      if (evt.defaultPrevented && jQueryEvent) {
        jQueryEvent.preventDefault();
      }
      return evt;
    }
  };
  function hydrateObj(obj, meta = {}) {
    for (const [key, value] of Object.entries(meta)) {
      try {
        obj[key] = value;
      } catch (_unused) {
        Object.defineProperty(obj, key, {
          configurable: true,
          get() {
            return value;
          }
        });
      }
    }
    return obj;
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): dom/data.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const elementMap = new Map();
  const Data = {
    set(element, key, instance) {
      if (!elementMap.has(element)) {
        elementMap.set(element, new Map());
      }
      const instanceMap = elementMap.get(element);

      // make it clear we only want one instance per element
      // can be removed later when multiple key/instances are fine to be used
      if (!instanceMap.has(key) && instanceMap.size !== 0) {
        // eslint-disable-next-line no-console
        console.error(`Bootstrap doesn't allow more than one instance per element. Bound instance: ${Array.from(instanceMap.keys())[0]}.`);
        return;
      }
      instanceMap.set(key, instance);
    },
    get(element, key) {
      if (elementMap.has(element)) {
        return elementMap.get(element).get(key) || null;
      }
      return null;
    },
    remove(element, key) {
      if (!elementMap.has(element)) {
        return;
      }
      const instanceMap = elementMap.get(element);
      instanceMap.delete(key);

      // free up element references if there are no instances left for an element
      if (instanceMap.size === 0) {
        elementMap.delete(element);
      }
    }
  };

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): dom/manipulator.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  function normalizeData(value) {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    if (value === Number(value).toString()) {
      return Number(value);
    }
    if (value === '' || value === 'null') {
      return null;
    }
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch (_unused) {
      return value;
    }
  }
  function normalizeDataKey(key) {
    return key.replace(/[A-Z]/g, chr => `-${chr.toLowerCase()}`);
  }
  const Manipulator = {
    setDataAttribute(element, key, value) {
      element.setAttribute(`data-bs-${normalizeDataKey(key)}`, value);
    },
    removeDataAttribute(element, key) {
      element.removeAttribute(`data-bs-${normalizeDataKey(key)}`);
    },
    getDataAttributes(element) {
      if (!element) {
        return {};
      }
      const attributes = {};
      const bsKeys = Object.keys(element.dataset).filter(key => key.startsWith('bs') && !key.startsWith('bsConfig'));
      for (const key of bsKeys) {
        let pureKey = key.replace(/^bs/, '');
        pureKey = pureKey.charAt(0).toLowerCase() + pureKey.slice(1, pureKey.length);
        attributes[pureKey] = normalizeData(element.dataset[key]);
      }
      return attributes;
    },
    getDataAttribute(element, key) {
      return normalizeData(element.getAttribute(`data-bs-${normalizeDataKey(key)}`));
    }
  };

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/config.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Class definition
   */

  let Config$1 = class Config {
    // Getters
    static get Default() {
      return {};
    }
    static get DefaultType() {
      return {};
    }
    static get NAME() {
      throw new Error('You have to implement the static method "NAME", for each component!');
    }
    _getConfig(config) {
      config = this._mergeConfigObj(config);
      config = this._configAfterMerge(config);
      this._typeCheckConfig(config);
      return config;
    }
    _configAfterMerge(config) {
      return config;
    }
    _mergeConfigObj(config, element) {
      const jsonConfig = isElement$2(element) ? Manipulator.getDataAttribute(element, 'config') : {}; // try to parse

      return {
        ...this.constructor.Default,
        ...(typeof jsonConfig === 'object' ? jsonConfig : {}),
        ...(isElement$2(element) ? Manipulator.getDataAttributes(element) : {}),
        ...(typeof config === 'object' ? config : {})
      };
    }
    _typeCheckConfig(config, configTypes = this.constructor.DefaultType) {
      for (const [property, expectedTypes] of Object.entries(configTypes)) {
        const value = config[property];
        const valueType = isElement$2(value) ? 'element' : toType(value);
        if (!new RegExp(expectedTypes).test(valueType)) {
          throw new TypeError(`${this.constructor.NAME.toUpperCase()}: Option "${property}" provided type "${valueType}" but expected type "${expectedTypes}".`);
        }
      }
    }
  };

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): base-component.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const VERSION = '5.3.0-alpha1';

  /**
   * Class definition
   */

  class BaseComponent extends Config$1 {
    constructor(element, config) {
      super();
      element = getElement(element);
      if (!element) {
        return;
      }
      this._element = element;
      this._config = this._getConfig(config);
      Data.set(this._element, this.constructor.DATA_KEY, this);
    }

    // Public
    dispose() {
      Data.remove(this._element, this.constructor.DATA_KEY);
      EventHandler.off(this._element, this.constructor.EVENT_KEY);
      for (const propertyName of Object.getOwnPropertyNames(this)) {
        this[propertyName] = null;
      }
    }
    _queueCallback(callback, element, isAnimated = true) {
      executeAfterTransition(callback, element, isAnimated);
    }
    _getConfig(config) {
      config = this._mergeConfigObj(config, this._element);
      config = this._configAfterMerge(config);
      this._typeCheckConfig(config);
      return config;
    }

    // Static
    static getInstance(element) {
      return Data.get(getElement(element), this.DATA_KEY);
    }
    static getOrCreateInstance(element, config = {}) {
      return this.getInstance(element) || new this(element, typeof config === 'object' ? config : null);
    }
    static get VERSION() {
      return VERSION;
    }
    static get DATA_KEY() {
      return `bs.${this.NAME}`;
    }
    static get EVENT_KEY() {
      return `.${this.DATA_KEY}`;
    }
    static eventName(name) {
      return `${name}${this.EVENT_KEY}`;
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): dom/selector-engine.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */
  const getSelector = element => {
    let selector = element.getAttribute('data-bs-target');
    if (!selector || selector === '#') {
      let hrefAttribute = element.getAttribute('href');

      // The only valid content that could double as a selector are IDs or classes,
      // so everything starting with `#` or `.`. If a "real" URL is used as the selector,
      // `document.querySelector` will rightfully complain it is invalid.
      // See https://github.com/twbs/bootstrap/issues/32273
      if (!hrefAttribute || !hrefAttribute.includes('#') && !hrefAttribute.startsWith('.')) {
        return null;
      }

      // Just in case some CMS puts out a full URL with the anchor appended
      if (hrefAttribute.includes('#') && !hrefAttribute.startsWith('#')) {
        hrefAttribute = `#${hrefAttribute.split('#')[1]}`;
      }
      selector = hrefAttribute && hrefAttribute !== '#' ? hrefAttribute.trim() : null;
    }
    return parseSelector(selector);
  };
  const SelectorEngine = {
    find(selector, element = document.documentElement) {
      return [].concat(...Element.prototype.querySelectorAll.call(element, selector));
    },
    findOne(selector, element = document.documentElement) {
      return Element.prototype.querySelector.call(element, selector);
    },
    children(element, selector) {
      return [].concat(...element.children).filter(child => child.matches(selector));
    },
    parents(element, selector) {
      const parents = [];
      let ancestor = element.parentNode.closest(selector);
      while (ancestor) {
        parents.push(ancestor);
        ancestor = ancestor.parentNode.closest(selector);
      }
      return parents;
    },
    prev(element, selector) {
      let previous = element.previousElementSibling;
      while (previous) {
        if (previous.matches(selector)) {
          return [previous];
        }
        previous = previous.previousElementSibling;
      }
      return [];
    },
    // TODO: this is now unused; remove later along with prev()
    next(element, selector) {
      let next = element.nextElementSibling;
      while (next) {
        if (next.matches(selector)) {
          return [next];
        }
        next = next.nextElementSibling;
      }
      return [];
    },
    focusableChildren(element) {
      const focusables = ['a', 'button', 'input', 'textarea', 'select', 'details', '[tabindex]', '[contenteditable="true"]'].map(selector => `${selector}:not([tabindex^="-"])`).join(',');
      return this.find(focusables, element).filter(el => !isDisabled(el) && isVisible(el));
    },
    getSelectorFromElement(element) {
      const selector = getSelector(element);
      if (selector) {
        return SelectorEngine.findOne(selector) ? selector : null;
      }
      return null;
    },
    getElementFromSelector(element) {
      const selector = getSelector(element);
      return selector ? SelectorEngine.findOne(selector) : null;
    },
    getMultipleElementsFromSelector(element) {
      const selector = getSelector(element);
      return selector ? SelectorEngine.find(selector) : [];
    }
  };

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/component-functions.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */
  const enableDismissTrigger = (component, method = 'hide') => {
    const clickEvent = `click.dismiss${component.EVENT_KEY}`;
    const name = component.NAME;
    EventHandler.on(document, clickEvent, `[data-bs-dismiss="${name}"]`, function (event) {
      if (['A', 'AREA'].includes(this.tagName)) {
        event.preventDefault();
      }
      if (isDisabled(this)) {
        return;
      }
      const target = SelectorEngine.getElementFromSelector(this) || this.closest(`.${name}`);
      const instance = component.getOrCreateInstance(target);

      // Method argument is left, for Alert and only, as it doesn't implement the 'hide' method
      instance[method]();
    });
  };

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): alert.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$f = 'alert';
  const DATA_KEY$a = 'bs.alert';
  const EVENT_KEY$b = `.${DATA_KEY$a}`;
  const EVENT_CLOSE = `close${EVENT_KEY$b}`;
  const EVENT_CLOSED = `closed${EVENT_KEY$b}`;
  const CLASS_NAME_FADE$5 = 'fade';
  const CLASS_NAME_SHOW$8 = 'show';

  /**
   * Class definition
   */

  class Alert extends BaseComponent {
    // Getters
    static get NAME() {
      return NAME$f;
    }

    // Public
    close() {
      const closeEvent = EventHandler.trigger(this._element, EVENT_CLOSE);
      if (closeEvent.defaultPrevented) {
        return;
      }
      this._element.classList.remove(CLASS_NAME_SHOW$8);
      const isAnimated = this._element.classList.contains(CLASS_NAME_FADE$5);
      this._queueCallback(() => this._destroyElement(), this._element, isAnimated);
    }

    // Private
    _destroyElement() {
      this._element.remove();
      EventHandler.trigger(this._element, EVENT_CLOSED);
      this.dispose();
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Alert.getOrCreateInstance(this);
        if (typeof config !== 'string') {
          return;
        }
        if (data[config] === undefined || config.startsWith('_') || config === 'constructor') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config](this);
      });
    }
  }

  /**
   * Data API implementation
   */

  enableDismissTrigger(Alert, 'close');

  /**
   * jQuery
   */

  defineJQueryPlugin(Alert);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): button.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$e = 'button';
  const DATA_KEY$9 = 'bs.button';
  const EVENT_KEY$a = `.${DATA_KEY$9}`;
  const DATA_API_KEY$6 = '.data-api';
  const CLASS_NAME_ACTIVE$3 = 'active';
  const SELECTOR_DATA_TOGGLE$5 = '[data-bs-toggle="button"]';
  const EVENT_CLICK_DATA_API$6 = `click${EVENT_KEY$a}${DATA_API_KEY$6}`;

  /**
   * Class definition
   */

  class Button extends BaseComponent {
    // Getters
    static get NAME() {
      return NAME$e;
    }

    // Public
    toggle() {
      // Toggle class and sync the `aria-pressed` attribute with the return value of the `.toggle()` method
      this._element.setAttribute('aria-pressed', this._element.classList.toggle(CLASS_NAME_ACTIVE$3));
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Button.getOrCreateInstance(this);
        if (config === 'toggle') {
          data[config]();
        }
      });
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(document, EVENT_CLICK_DATA_API$6, SELECTOR_DATA_TOGGLE$5, event => {
    event.preventDefault();
    const button = event.target.closest(SELECTOR_DATA_TOGGLE$5);
    const data = Button.getOrCreateInstance(button);
    data.toggle();
  });

  /**
   * jQuery
   */

  defineJQueryPlugin(Button);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/swipe.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$d = 'swipe';
  const EVENT_KEY$9 = '.bs.swipe';
  const EVENT_TOUCHSTART = `touchstart${EVENT_KEY$9}`;
  const EVENT_TOUCHMOVE = `touchmove${EVENT_KEY$9}`;
  const EVENT_TOUCHEND = `touchend${EVENT_KEY$9}`;
  const EVENT_POINTERDOWN = `pointerdown${EVENT_KEY$9}`;
  const EVENT_POINTERUP = `pointerup${EVENT_KEY$9}`;
  const POINTER_TYPE_TOUCH = 'touch';
  const POINTER_TYPE_PEN = 'pen';
  const CLASS_NAME_POINTER_EVENT = 'pointer-event';
  const SWIPE_THRESHOLD = 40;
  const Default$c = {
    endCallback: null,
    leftCallback: null,
    rightCallback: null
  };
  const DefaultType$c = {
    endCallback: '(function|null)',
    leftCallback: '(function|null)',
    rightCallback: '(function|null)'
  };

  /**
   * Class definition
   */

  class Swipe extends Config$1 {
    constructor(element, config) {
      super();
      this._element = element;
      if (!element || !Swipe.isSupported()) {
        return;
      }
      this._config = this._getConfig(config);
      this._deltaX = 0;
      this._supportPointerEvents = Boolean(window.PointerEvent);
      this._initEvents();
    }

    // Getters
    static get Default() {
      return Default$c;
    }
    static get DefaultType() {
      return DefaultType$c;
    }
    static get NAME() {
      return NAME$d;
    }

    // Public
    dispose() {
      EventHandler.off(this._element, EVENT_KEY$9);
    }

    // Private
    _start(event) {
      if (!this._supportPointerEvents) {
        this._deltaX = event.touches[0].clientX;
        return;
      }
      if (this._eventIsPointerPenTouch(event)) {
        this._deltaX = event.clientX;
      }
    }
    _end(event) {
      if (this._eventIsPointerPenTouch(event)) {
        this._deltaX = event.clientX - this._deltaX;
      }
      this._handleSwipe();
      execute(this._config.endCallback);
    }
    _move(event) {
      this._deltaX = event.touches && event.touches.length > 1 ? 0 : event.touches[0].clientX - this._deltaX;
    }
    _handleSwipe() {
      const absDeltaX = Math.abs(this._deltaX);
      if (absDeltaX <= SWIPE_THRESHOLD) {
        return;
      }
      const direction = absDeltaX / this._deltaX;
      this._deltaX = 0;
      if (!direction) {
        return;
      }
      execute(direction > 0 ? this._config.rightCallback : this._config.leftCallback);
    }
    _initEvents() {
      if (this._supportPointerEvents) {
        EventHandler.on(this._element, EVENT_POINTERDOWN, event => this._start(event));
        EventHandler.on(this._element, EVENT_POINTERUP, event => this._end(event));
        this._element.classList.add(CLASS_NAME_POINTER_EVENT);
      } else {
        EventHandler.on(this._element, EVENT_TOUCHSTART, event => this._start(event));
        EventHandler.on(this._element, EVENT_TOUCHMOVE, event => this._move(event));
        EventHandler.on(this._element, EVENT_TOUCHEND, event => this._end(event));
      }
    }
    _eventIsPointerPenTouch(event) {
      return this._supportPointerEvents && (event.pointerType === POINTER_TYPE_PEN || event.pointerType === POINTER_TYPE_TOUCH);
    }

    // Static
    static isSupported() {
      return 'ontouchstart' in document.documentElement || navigator.maxTouchPoints > 0;
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): carousel.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$c = 'carousel';
  const DATA_KEY$8 = 'bs.carousel';
  const EVENT_KEY$8 = `.${DATA_KEY$8}`;
  const DATA_API_KEY$5 = '.data-api';
  const ARROW_LEFT_KEY$1 = 'ArrowLeft';
  const ARROW_RIGHT_KEY$1 = 'ArrowRight';
  const TOUCHEVENT_COMPAT_WAIT = 500; // Time for mouse compat events to fire after touch

  const ORDER_NEXT = 'next';
  const ORDER_PREV = 'prev';
  const DIRECTION_LEFT = 'left';
  const DIRECTION_RIGHT = 'right';
  const EVENT_SLIDE = `slide${EVENT_KEY$8}`;
  const EVENT_SLID = `slid${EVENT_KEY$8}`;
  const EVENT_KEYDOWN$1 = `keydown${EVENT_KEY$8}`;
  const EVENT_MOUSEENTER$1 = `mouseenter${EVENT_KEY$8}`;
  const EVENT_MOUSELEAVE$1 = `mouseleave${EVENT_KEY$8}`;
  const EVENT_DRAG_START = `dragstart${EVENT_KEY$8}`;
  const EVENT_LOAD_DATA_API$3 = `load${EVENT_KEY$8}${DATA_API_KEY$5}`;
  const EVENT_CLICK_DATA_API$5 = `click${EVENT_KEY$8}${DATA_API_KEY$5}`;
  const CLASS_NAME_CAROUSEL = 'carousel';
  const CLASS_NAME_ACTIVE$2 = 'active';
  const CLASS_NAME_SLIDE = 'slide';
  const CLASS_NAME_END = 'carousel-item-end';
  const CLASS_NAME_START = 'carousel-item-start';
  const CLASS_NAME_NEXT = 'carousel-item-next';
  const CLASS_NAME_PREV = 'carousel-item-prev';
  const SELECTOR_ACTIVE = '.active';
  const SELECTOR_ITEM = '.carousel-item';
  const SELECTOR_ACTIVE_ITEM = SELECTOR_ACTIVE + SELECTOR_ITEM;
  const SELECTOR_ITEM_IMG = '.carousel-item img';
  const SELECTOR_INDICATORS = '.carousel-indicators';
  const SELECTOR_DATA_SLIDE = '[data-bs-slide], [data-bs-slide-to]';
  const SELECTOR_DATA_RIDE = '[data-bs-ride="carousel"]';
  const KEY_TO_DIRECTION = {
    [ARROW_LEFT_KEY$1]: DIRECTION_RIGHT,
    [ARROW_RIGHT_KEY$1]: DIRECTION_LEFT
  };
  const Default$b = {
    interval: 5000,
    keyboard: true,
    pause: 'hover',
    ride: false,
    touch: true,
    wrap: true
  };
  const DefaultType$b = {
    interval: '(number|boolean)',
    // TODO:v6 remove boolean support
    keyboard: 'boolean',
    pause: '(string|boolean)',
    ride: '(boolean|string)',
    touch: 'boolean',
    wrap: 'boolean'
  };

  /**
   * Class definition
   */

  class Carousel extends BaseComponent {
    constructor(element, config) {
      super(element, config);
      this._interval = null;
      this._activeElement = null;
      this._isSliding = false;
      this.touchTimeout = null;
      this._swipeHelper = null;
      this._indicatorsElement = SelectorEngine.findOne(SELECTOR_INDICATORS, this._element);
      this._addEventListeners();
      if (this._config.ride === CLASS_NAME_CAROUSEL) {
        this.cycle();
      }
    }

    // Getters
    static get Default() {
      return Default$b;
    }
    static get DefaultType() {
      return DefaultType$b;
    }
    static get NAME() {
      return NAME$c;
    }

    // Public
    next() {
      this._slide(ORDER_NEXT);
    }
    nextWhenVisible() {
      // FIXME TODO use `document.visibilityState`
      // Don't call next when the page isn't visible
      // or the carousel or its parent isn't visible
      if (!document.hidden && isVisible(this._element)) {
        this.next();
      }
    }
    prev() {
      this._slide(ORDER_PREV);
    }
    pause() {
      if (this._isSliding) {
        triggerTransitionEnd(this._element);
      }
      this._clearInterval();
    }
    cycle() {
      this._clearInterval();
      this._updateInterval();
      this._interval = setInterval(() => this.nextWhenVisible(), this._config.interval);
    }
    _maybeEnableCycle() {
      if (!this._config.ride) {
        return;
      }
      if (this._isSliding) {
        EventHandler.one(this._element, EVENT_SLID, () => this.cycle());
        return;
      }
      this.cycle();
    }
    to(index) {
      const items = this._getItems();
      if (index > items.length - 1 || index < 0) {
        return;
      }
      if (this._isSliding) {
        EventHandler.one(this._element, EVENT_SLID, () => this.to(index));
        return;
      }
      const activeIndex = this._getItemIndex(this._getActive());
      if (activeIndex === index) {
        return;
      }
      const order = index > activeIndex ? ORDER_NEXT : ORDER_PREV;
      this._slide(order, items[index]);
    }
    dispose() {
      if (this._swipeHelper) {
        this._swipeHelper.dispose();
      }
      super.dispose();
    }

    // Private
    _configAfterMerge(config) {
      config.defaultInterval = config.interval;
      return config;
    }
    _addEventListeners() {
      if (this._config.keyboard) {
        EventHandler.on(this._element, EVENT_KEYDOWN$1, event => this._keydown(event));
      }
      if (this._config.pause === 'hover') {
        EventHandler.on(this._element, EVENT_MOUSEENTER$1, () => this.pause());
        EventHandler.on(this._element, EVENT_MOUSELEAVE$1, () => this._maybeEnableCycle());
      }
      if (this._config.touch && Swipe.isSupported()) {
        this._addTouchEventListeners();
      }
    }
    _addTouchEventListeners() {
      for (const img of SelectorEngine.find(SELECTOR_ITEM_IMG, this._element)) {
        EventHandler.on(img, EVENT_DRAG_START, event => event.preventDefault());
      }
      const endCallBack = () => {
        if (this._config.pause !== 'hover') {
          return;
        }

        // If it's a touch-enabled device, mouseenter/leave are fired as
        // part of the mouse compatibility events on first tap - the carousel
        // would stop cycling until user tapped out of it;
        // here, we listen for touchend, explicitly pause the carousel
        // (as if it's the second time we tap on it, mouseenter compat event
        // is NOT fired) and after a timeout (to allow for mouse compatibility
        // events to fire) we explicitly restart cycling

        this.pause();
        if (this.touchTimeout) {
          clearTimeout(this.touchTimeout);
        }
        this.touchTimeout = setTimeout(() => this._maybeEnableCycle(), TOUCHEVENT_COMPAT_WAIT + this._config.interval);
      };
      const swipeConfig = {
        leftCallback: () => this._slide(this._directionToOrder(DIRECTION_LEFT)),
        rightCallback: () => this._slide(this._directionToOrder(DIRECTION_RIGHT)),
        endCallback: endCallBack
      };
      this._swipeHelper = new Swipe(this._element, swipeConfig);
    }
    _keydown(event) {
      if (/input|textarea/i.test(event.target.tagName)) {
        return;
      }
      const direction = KEY_TO_DIRECTION[event.key];
      if (direction) {
        event.preventDefault();
        this._slide(this._directionToOrder(direction));
      }
    }
    _getItemIndex(element) {
      return this._getItems().indexOf(element);
    }
    _setActiveIndicatorElement(index) {
      if (!this._indicatorsElement) {
        return;
      }
      const activeIndicator = SelectorEngine.findOne(SELECTOR_ACTIVE, this._indicatorsElement);
      activeIndicator.classList.remove(CLASS_NAME_ACTIVE$2);
      activeIndicator.removeAttribute('aria-current');
      const newActiveIndicator = SelectorEngine.findOne(`[data-bs-slide-to="${index}"]`, this._indicatorsElement);
      if (newActiveIndicator) {
        newActiveIndicator.classList.add(CLASS_NAME_ACTIVE$2);
        newActiveIndicator.setAttribute('aria-current', 'true');
      }
    }
    _updateInterval() {
      const element = this._activeElement || this._getActive();
      if (!element) {
        return;
      }
      const elementInterval = Number.parseInt(element.getAttribute('data-bs-interval'), 10);
      this._config.interval = elementInterval || this._config.defaultInterval;
    }
    _slide(order, element = null) {
      if (this._isSliding) {
        return;
      }
      const activeElement = this._getActive();
      const isNext = order === ORDER_NEXT;
      const nextElement = element || getNextActiveElement(this._getItems(), activeElement, isNext, this._config.wrap);
      if (nextElement === activeElement) {
        return;
      }
      const nextElementIndex = this._getItemIndex(nextElement);
      const triggerEvent = eventName => {
        return EventHandler.trigger(this._element, eventName, {
          relatedTarget: nextElement,
          direction: this._orderToDirection(order),
          from: this._getItemIndex(activeElement),
          to: nextElementIndex
        });
      };
      const slideEvent = triggerEvent(EVENT_SLIDE);
      if (slideEvent.defaultPrevented) {
        return;
      }
      if (!activeElement || !nextElement) {
        // Some weirdness is happening, so we bail
        // todo: change tests that use empty divs to avoid this check
        return;
      }
      const isCycling = Boolean(this._interval);
      this.pause();
      this._isSliding = true;
      this._setActiveIndicatorElement(nextElementIndex);
      this._activeElement = nextElement;
      const directionalClassName = isNext ? CLASS_NAME_START : CLASS_NAME_END;
      const orderClassName = isNext ? CLASS_NAME_NEXT : CLASS_NAME_PREV;
      nextElement.classList.add(orderClassName);
      reflow(nextElement);
      activeElement.classList.add(directionalClassName);
      nextElement.classList.add(directionalClassName);
      const completeCallBack = () => {
        nextElement.classList.remove(directionalClassName, orderClassName);
        nextElement.classList.add(CLASS_NAME_ACTIVE$2);
        activeElement.classList.remove(CLASS_NAME_ACTIVE$2, orderClassName, directionalClassName);
        this._isSliding = false;
        triggerEvent(EVENT_SLID);
      };
      this._queueCallback(completeCallBack, activeElement, this._isAnimated());
      if (isCycling) {
        this.cycle();
      }
    }
    _isAnimated() {
      return this._element.classList.contains(CLASS_NAME_SLIDE);
    }
    _getActive() {
      return SelectorEngine.findOne(SELECTOR_ACTIVE_ITEM, this._element);
    }
    _getItems() {
      return SelectorEngine.find(SELECTOR_ITEM, this._element);
    }
    _clearInterval() {
      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }
    }
    _directionToOrder(direction) {
      if (isRTL()) {
        return direction === DIRECTION_LEFT ? ORDER_PREV : ORDER_NEXT;
      }
      return direction === DIRECTION_LEFT ? ORDER_NEXT : ORDER_PREV;
    }
    _orderToDirection(order) {
      if (isRTL()) {
        return order === ORDER_PREV ? DIRECTION_LEFT : DIRECTION_RIGHT;
      }
      return order === ORDER_PREV ? DIRECTION_RIGHT : DIRECTION_LEFT;
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Carousel.getOrCreateInstance(this, config);
        if (typeof config === 'number') {
          data.to(config);
          return;
        }
        if (typeof config === 'string') {
          if (data[config] === undefined || config.startsWith('_') || config === 'constructor') {
            throw new TypeError(`No method named "${config}"`);
          }
          data[config]();
        }
      });
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(document, EVENT_CLICK_DATA_API$5, SELECTOR_DATA_SLIDE, function (event) {
    const target = SelectorEngine.getElementFromSelector(this);
    if (!target || !target.classList.contains(CLASS_NAME_CAROUSEL)) {
      return;
    }
    event.preventDefault();
    const carousel = Carousel.getOrCreateInstance(target);
    const slideIndex = this.getAttribute('data-bs-slide-to');
    if (slideIndex) {
      carousel.to(slideIndex);
      carousel._maybeEnableCycle();
      return;
    }
    if (Manipulator.getDataAttribute(this, 'slide') === 'next') {
      carousel.next();
      carousel._maybeEnableCycle();
      return;
    }
    carousel.prev();
    carousel._maybeEnableCycle();
  });
  EventHandler.on(window, EVENT_LOAD_DATA_API$3, () => {
    const carousels = SelectorEngine.find(SELECTOR_DATA_RIDE);
    for (const carousel of carousels) {
      Carousel.getOrCreateInstance(carousel);
    }
  });

  /**
   * jQuery
   */

  defineJQueryPlugin(Carousel);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): collapse.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$b = 'collapse';
  const DATA_KEY$7 = 'bs.collapse';
  const EVENT_KEY$7 = `.${DATA_KEY$7}`;
  const DATA_API_KEY$4 = '.data-api';
  const EVENT_SHOW$6 = `show${EVENT_KEY$7}`;
  const EVENT_SHOWN$6 = `shown${EVENT_KEY$7}`;
  const EVENT_HIDE$6 = `hide${EVENT_KEY$7}`;
  const EVENT_HIDDEN$6 = `hidden${EVENT_KEY$7}`;
  const EVENT_CLICK_DATA_API$4 = `click${EVENT_KEY$7}${DATA_API_KEY$4}`;
  const CLASS_NAME_SHOW$7 = 'show';
  const CLASS_NAME_COLLAPSE = 'collapse';
  const CLASS_NAME_COLLAPSING = 'collapsing';
  const CLASS_NAME_COLLAPSED = 'collapsed';
  const CLASS_NAME_DEEPER_CHILDREN = `:scope .${CLASS_NAME_COLLAPSE} .${CLASS_NAME_COLLAPSE}`;
  const CLASS_NAME_HORIZONTAL = 'collapse-horizontal';
  const WIDTH = 'width';
  const HEIGHT = 'height';
  const SELECTOR_ACTIVES = '.collapse.show, .collapse.collapsing';
  const SELECTOR_DATA_TOGGLE$4 = '[data-bs-toggle="collapse"]';
  const Default$a = {
    parent: null,
    toggle: true
  };
  const DefaultType$a = {
    parent: '(null|element)',
    toggle: 'boolean'
  };

  /**
   * Class definition
   */

  class Collapse extends BaseComponent {
    constructor(element, config) {
      super(element, config);
      this._isTransitioning = false;
      this._triggerArray = [];
      const toggleList = SelectorEngine.find(SELECTOR_DATA_TOGGLE$4);
      for (const elem of toggleList) {
        const selector = SelectorEngine.getSelectorFromElement(elem);
        const filterElement = SelectorEngine.find(selector).filter(foundElement => foundElement === this._element);
        if (selector !== null && filterElement.length) {
          this._triggerArray.push(elem);
        }
      }
      this._initializeChildren();
      if (!this._config.parent) {
        this._addAriaAndCollapsedClass(this._triggerArray, this._isShown());
      }
      if (this._config.toggle) {
        this.toggle();
      }
    }

    // Getters
    static get Default() {
      return Default$a;
    }
    static get DefaultType() {
      return DefaultType$a;
    }
    static get NAME() {
      return NAME$b;
    }

    // Public
    toggle() {
      if (this._isShown()) {
        this.hide();
      } else {
        this.show();
      }
    }
    show() {
      if (this._isTransitioning || this._isShown()) {
        return;
      }
      let activeChildren = [];

      // find active children
      if (this._config.parent) {
        activeChildren = this._getFirstLevelChildren(SELECTOR_ACTIVES).filter(element => element !== this._element).map(element => Collapse.getOrCreateInstance(element, {
          toggle: false
        }));
      }
      if (activeChildren.length && activeChildren[0]._isTransitioning) {
        return;
      }
      const startEvent = EventHandler.trigger(this._element, EVENT_SHOW$6);
      if (startEvent.defaultPrevented) {
        return;
      }
      for (const activeInstance of activeChildren) {
        activeInstance.hide();
      }
      const dimension = this._getDimension();
      this._element.classList.remove(CLASS_NAME_COLLAPSE);
      this._element.classList.add(CLASS_NAME_COLLAPSING);
      this._element.style[dimension] = 0;
      this._addAriaAndCollapsedClass(this._triggerArray, true);
      this._isTransitioning = true;
      const complete = () => {
        this._isTransitioning = false;
        this._element.classList.remove(CLASS_NAME_COLLAPSING);
        this._element.classList.add(CLASS_NAME_COLLAPSE, CLASS_NAME_SHOW$7);
        this._element.style[dimension] = '';
        EventHandler.trigger(this._element, EVENT_SHOWN$6);
      };
      const capitalizedDimension = dimension[0].toUpperCase() + dimension.slice(1);
      const scrollSize = `scroll${capitalizedDimension}`;
      this._queueCallback(complete, this._element, true);
      this._element.style[dimension] = `${this._element[scrollSize]}px`;
    }
    hide() {
      if (this._isTransitioning || !this._isShown()) {
        return;
      }
      const startEvent = EventHandler.trigger(this._element, EVENT_HIDE$6);
      if (startEvent.defaultPrevented) {
        return;
      }
      const dimension = this._getDimension();
      this._element.style[dimension] = `${this._element.getBoundingClientRect()[dimension]}px`;
      reflow(this._element);
      this._element.classList.add(CLASS_NAME_COLLAPSING);
      this._element.classList.remove(CLASS_NAME_COLLAPSE, CLASS_NAME_SHOW$7);
      for (const trigger of this._triggerArray) {
        const element = SelectorEngine.getElementFromSelector(trigger);
        if (element && !this._isShown(element)) {
          this._addAriaAndCollapsedClass([trigger], false);
        }
      }
      this._isTransitioning = true;
      const complete = () => {
        this._isTransitioning = false;
        this._element.classList.remove(CLASS_NAME_COLLAPSING);
        this._element.classList.add(CLASS_NAME_COLLAPSE);
        EventHandler.trigger(this._element, EVENT_HIDDEN$6);
      };
      this._element.style[dimension] = '';
      this._queueCallback(complete, this._element, true);
    }
    _isShown(element = this._element) {
      return element.classList.contains(CLASS_NAME_SHOW$7);
    }

    // Private
    _configAfterMerge(config) {
      config.toggle = Boolean(config.toggle); // Coerce string values
      config.parent = getElement(config.parent);
      return config;
    }
    _getDimension() {
      return this._element.classList.contains(CLASS_NAME_HORIZONTAL) ? WIDTH : HEIGHT;
    }
    _initializeChildren() {
      if (!this._config.parent) {
        return;
      }
      const children = this._getFirstLevelChildren(SELECTOR_DATA_TOGGLE$4);
      for (const element of children) {
        const selected = SelectorEngine.getElementFromSelector(element);
        if (selected) {
          this._addAriaAndCollapsedClass([element], this._isShown(selected));
        }
      }
    }
    _getFirstLevelChildren(selector) {
      const children = SelectorEngine.find(CLASS_NAME_DEEPER_CHILDREN, this._config.parent);
      // remove children if greater depth
      return SelectorEngine.find(selector, this._config.parent).filter(element => !children.includes(element));
    }
    _addAriaAndCollapsedClass(triggerArray, isOpen) {
      if (!triggerArray.length) {
        return;
      }
      for (const element of triggerArray) {
        element.classList.toggle(CLASS_NAME_COLLAPSED, !isOpen);
        element.setAttribute('aria-expanded', isOpen);
      }
    }

    // Static
    static jQueryInterface(config) {
      const _config = {};
      if (typeof config === 'string' && /show|hide/.test(config)) {
        _config.toggle = false;
      }
      return this.each(function () {
        const data = Collapse.getOrCreateInstance(this, _config);
        if (typeof config === 'string') {
          if (typeof data[config] === 'undefined') {
            throw new TypeError(`No method named "${config}"`);
          }
          data[config]();
        }
      });
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(document, EVENT_CLICK_DATA_API$4, SELECTOR_DATA_TOGGLE$4, function (event) {
    // preventDefault only for <a> elements (which change the URL) not inside the collapsible element
    if (event.target.tagName === 'A' || event.delegateTarget && event.delegateTarget.tagName === 'A') {
      event.preventDefault();
    }
    for (const element of SelectorEngine.getMultipleElementsFromSelector(this)) {
      Collapse.getOrCreateInstance(element, {
        toggle: false
      }).toggle();
    }
  });

  /**
   * jQuery
   */

  defineJQueryPlugin(Collapse);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): dropdown.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$a = 'dropdown';
  const DATA_KEY$6 = 'bs.dropdown';
  const EVENT_KEY$6 = `.${DATA_KEY$6}`;
  const DATA_API_KEY$3 = '.data-api';
  const ESCAPE_KEY$2 = 'Escape';
  const TAB_KEY$1 = 'Tab';
  const ARROW_UP_KEY$1 = 'ArrowUp';
  const ARROW_DOWN_KEY$1 = 'ArrowDown';
  const RIGHT_MOUSE_BUTTON = 2; // MouseEvent.button value for the secondary button, usually the right button

  const EVENT_HIDE$5 = `hide${EVENT_KEY$6}`;
  const EVENT_HIDDEN$5 = `hidden${EVENT_KEY$6}`;
  const EVENT_SHOW$5 = `show${EVENT_KEY$6}`;
  const EVENT_SHOWN$5 = `shown${EVENT_KEY$6}`;
  const EVENT_CLICK_DATA_API$3 = `click${EVENT_KEY$6}${DATA_API_KEY$3}`;
  const EVENT_KEYDOWN_DATA_API = `keydown${EVENT_KEY$6}${DATA_API_KEY$3}`;
  const EVENT_KEYUP_DATA_API = `keyup${EVENT_KEY$6}${DATA_API_KEY$3}`;
  const CLASS_NAME_SHOW$6 = 'show';
  const CLASS_NAME_DROPUP = 'dropup';
  const CLASS_NAME_DROPEND = 'dropend';
  const CLASS_NAME_DROPSTART = 'dropstart';
  const CLASS_NAME_DROPUP_CENTER = 'dropup-center';
  const CLASS_NAME_DROPDOWN_CENTER = 'dropdown-center';
  const SELECTOR_DATA_TOGGLE$3 = '[data-bs-toggle="dropdown"]:not(.disabled):not(:disabled)';
  const SELECTOR_DATA_TOGGLE_SHOWN = `${SELECTOR_DATA_TOGGLE$3}.${CLASS_NAME_SHOW$6}`;
  const SELECTOR_MENU = '.dropdown-menu';
  const SELECTOR_NAVBAR = '.navbar';
  const SELECTOR_NAVBAR_NAV = '.navbar-nav';
  const SELECTOR_VISIBLE_ITEMS = '.dropdown-menu .dropdown-item:not(.disabled):not(:disabled)';
  const PLACEMENT_TOP = isRTL() ? 'top-end' : 'top-start';
  const PLACEMENT_TOPEND = isRTL() ? 'top-start' : 'top-end';
  const PLACEMENT_BOTTOM = isRTL() ? 'bottom-end' : 'bottom-start';
  const PLACEMENT_BOTTOMEND = isRTL() ? 'bottom-start' : 'bottom-end';
  const PLACEMENT_RIGHT = isRTL() ? 'left-start' : 'right-start';
  const PLACEMENT_LEFT = isRTL() ? 'right-start' : 'left-start';
  const PLACEMENT_TOPCENTER = 'top';
  const PLACEMENT_BOTTOMCENTER = 'bottom';
  const Default$9 = {
    autoClose: true,
    boundary: 'clippingParents',
    display: 'dynamic',
    offset: [0, 2],
    popperConfig: null,
    reference: 'toggle'
  };
  const DefaultType$9 = {
    autoClose: '(boolean|string)',
    boundary: '(string|element)',
    display: 'string',
    offset: '(array|string|function)',
    popperConfig: '(null|object|function)',
    reference: '(string|element|object)'
  };

  /**
   * Class definition
   */

  class Dropdown extends BaseComponent {
    constructor(element, config) {
      super(element, config);
      this._popper = null;
      this._parent = this._element.parentNode; // dropdown wrapper
      // todo: v6 revert #37011 & change markup https://getbootstrap.com/docs/5.3/forms/input-group/
      this._menu = SelectorEngine.next(this._element, SELECTOR_MENU)[0] || SelectorEngine.prev(this._element, SELECTOR_MENU)[0] || SelectorEngine.findOne(SELECTOR_MENU, this._parent);
      this._inNavbar = this._detectNavbar();
    }

    // Getters
    static get Default() {
      return Default$9;
    }
    static get DefaultType() {
      return DefaultType$9;
    }
    static get NAME() {
      return NAME$a;
    }

    // Public
    toggle() {
      return this._isShown() ? this.hide() : this.show();
    }
    show() {
      if (isDisabled(this._element) || this._isShown()) {
        return;
      }
      const relatedTarget = {
        relatedTarget: this._element
      };
      const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$5, relatedTarget);
      if (showEvent.defaultPrevented) {
        return;
      }
      this._createPopper();

      // If this is a touch-enabled device we add extra
      // empty mouseover listeners to the body's immediate children;
      // only needed because of broken event delegation on iOS
      // https://www.quirksmode.org/blog/archives/2014/02/mouse_event_bub.html
      if ('ontouchstart' in document.documentElement && !this._parent.closest(SELECTOR_NAVBAR_NAV)) {
        for (const element of [].concat(...document.body.children)) {
          EventHandler.on(element, 'mouseover', noop$1);
        }
      }
      this._element.focus();
      this._element.setAttribute('aria-expanded', true);
      this._menu.classList.add(CLASS_NAME_SHOW$6);
      this._element.classList.add(CLASS_NAME_SHOW$6);
      EventHandler.trigger(this._element, EVENT_SHOWN$5, relatedTarget);
    }
    hide() {
      if (isDisabled(this._element) || !this._isShown()) {
        return;
      }
      const relatedTarget = {
        relatedTarget: this._element
      };
      this._completeHide(relatedTarget);
    }
    dispose() {
      if (this._popper) {
        this._popper.destroy();
      }
      super.dispose();
    }
    update() {
      this._inNavbar = this._detectNavbar();
      if (this._popper) {
        this._popper.update();
      }
    }

    // Private
    _completeHide(relatedTarget) {
      const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$5, relatedTarget);
      if (hideEvent.defaultPrevented) {
        return;
      }

      // If this is a touch-enabled device we remove the extra
      // empty mouseover listeners we added for iOS support
      if ('ontouchstart' in document.documentElement) {
        for (const element of [].concat(...document.body.children)) {
          EventHandler.off(element, 'mouseover', noop$1);
        }
      }
      if (this._popper) {
        this._popper.destroy();
      }
      this._menu.classList.remove(CLASS_NAME_SHOW$6);
      this._element.classList.remove(CLASS_NAME_SHOW$6);
      this._element.setAttribute('aria-expanded', 'false');
      Manipulator.removeDataAttribute(this._menu, 'popper');
      EventHandler.trigger(this._element, EVENT_HIDDEN$5, relatedTarget);
    }
    _getConfig(config) {
      config = super._getConfig(config);
      if (typeof config.reference === 'object' && !isElement$2(config.reference) && typeof config.reference.getBoundingClientRect !== 'function') {
        // Popper virtual elements require a getBoundingClientRect method
        throw new TypeError(`${NAME$a.toUpperCase()}: Option "reference" provided type "object" without a required "getBoundingClientRect" method.`);
      }
      return config;
    }
    _createPopper() {
      if (typeof Popper === 'undefined') {
        throw new TypeError('Bootstrap\'s dropdowns require Popper (https://popper.js.org)');
      }
      let referenceElement = this._element;
      if (this._config.reference === 'parent') {
        referenceElement = this._parent;
      } else if (isElement$2(this._config.reference)) {
        referenceElement = getElement(this._config.reference);
      } else if (typeof this._config.reference === 'object') {
        referenceElement = this._config.reference;
      }
      const popperConfig = this._getPopperConfig();
      this._popper = createPopper(referenceElement, this._menu, popperConfig);
    }
    _isShown() {
      return this._menu.classList.contains(CLASS_NAME_SHOW$6);
    }
    _getPlacement() {
      const parentDropdown = this._parent;
      if (parentDropdown.classList.contains(CLASS_NAME_DROPEND)) {
        return PLACEMENT_RIGHT;
      }
      if (parentDropdown.classList.contains(CLASS_NAME_DROPSTART)) {
        return PLACEMENT_LEFT;
      }
      if (parentDropdown.classList.contains(CLASS_NAME_DROPUP_CENTER)) {
        return PLACEMENT_TOPCENTER;
      }
      if (parentDropdown.classList.contains(CLASS_NAME_DROPDOWN_CENTER)) {
        return PLACEMENT_BOTTOMCENTER;
      }

      // We need to trim the value because custom properties can also include spaces
      const isEnd = getComputedStyle(this._menu).getPropertyValue('--bs-position').trim() === 'end';
      if (parentDropdown.classList.contains(CLASS_NAME_DROPUP)) {
        return isEnd ? PLACEMENT_TOPEND : PLACEMENT_TOP;
      }
      return isEnd ? PLACEMENT_BOTTOMEND : PLACEMENT_BOTTOM;
    }
    _detectNavbar() {
      return this._element.closest(SELECTOR_NAVBAR) !== null;
    }
    _getOffset() {
      const {
        offset
      } = this._config;
      if (typeof offset === 'string') {
        return offset.split(',').map(value => Number.parseInt(value, 10));
      }
      if (typeof offset === 'function') {
        return popperData => offset(popperData, this._element);
      }
      return offset;
    }
    _getPopperConfig() {
      const defaultBsPopperConfig = {
        placement: this._getPlacement(),
        modifiers: [{
          name: 'preventOverflow',
          options: {
            boundary: this._config.boundary
          }
        }, {
          name: 'offset',
          options: {
            offset: this._getOffset()
          }
        }]
      };

      // Disable Popper if we have a static display or Dropdown is in Navbar
      if (this._inNavbar || this._config.display === 'static') {
        Manipulator.setDataAttribute(this._menu, 'popper', 'static'); // todo:v6 remove
        defaultBsPopperConfig.modifiers = [{
          name: 'applyStyles',
          enabled: false
        }];
      }
      return {
        ...defaultBsPopperConfig,
        ...execute(this._config.popperConfig, [defaultBsPopperConfig])
      };
    }
    _selectMenuItem({
      key,
      target
    }) {
      const items = SelectorEngine.find(SELECTOR_VISIBLE_ITEMS, this._menu).filter(element => isVisible(element));
      if (!items.length) {
        return;
      }

      // if target isn't included in items (e.g. when expanding the dropdown)
      // allow cycling to get the last item in case key equals ARROW_UP_KEY
      getNextActiveElement(items, target, key === ARROW_DOWN_KEY$1, !items.includes(target)).focus();
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Dropdown.getOrCreateInstance(this, config);
        if (typeof config !== 'string') {
          return;
        }
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config]();
      });
    }
    static clearMenus(event) {
      if (event.button === RIGHT_MOUSE_BUTTON || event.type === 'keyup' && event.key !== TAB_KEY$1) {
        return;
      }
      const openToggles = SelectorEngine.find(SELECTOR_DATA_TOGGLE_SHOWN);
      for (const toggle of openToggles) {
        const context = Dropdown.getInstance(toggle);
        if (!context || context._config.autoClose === false) {
          continue;
        }
        const composedPath = event.composedPath();
        const isMenuTarget = composedPath.includes(context._menu);
        if (composedPath.includes(context._element) || context._config.autoClose === 'inside' && !isMenuTarget || context._config.autoClose === 'outside' && isMenuTarget) {
          continue;
        }

        // Tab navigation through the dropdown menu or events from contained inputs shouldn't close the menu
        if (context._menu.contains(event.target) && (event.type === 'keyup' && event.key === TAB_KEY$1 || /input|select|option|textarea|form/i.test(event.target.tagName))) {
          continue;
        }
        const relatedTarget = {
          relatedTarget: context._element
        };
        if (event.type === 'click') {
          relatedTarget.clickEvent = event;
        }
        context._completeHide(relatedTarget);
      }
    }
    static dataApiKeydownHandler(event) {
      // If not an UP | DOWN | ESCAPE key => not a dropdown command
      // If input/textarea && if key is other than ESCAPE => not a dropdown command

      const isInput = /input|textarea/i.test(event.target.tagName);
      const isEscapeEvent = event.key === ESCAPE_KEY$2;
      const isUpOrDownEvent = [ARROW_UP_KEY$1, ARROW_DOWN_KEY$1].includes(event.key);
      if (!isUpOrDownEvent && !isEscapeEvent) {
        return;
      }
      if (isInput && !isEscapeEvent) {
        return;
      }
      event.preventDefault();

      // todo: v6 revert #37011 & change markup https://getbootstrap.com/docs/5.3/forms/input-group/
      const getToggleButton = this.matches(SELECTOR_DATA_TOGGLE$3) ? this : SelectorEngine.prev(this, SELECTOR_DATA_TOGGLE$3)[0] || SelectorEngine.next(this, SELECTOR_DATA_TOGGLE$3)[0] || SelectorEngine.findOne(SELECTOR_DATA_TOGGLE$3, event.delegateTarget.parentNode);
      const instance = Dropdown.getOrCreateInstance(getToggleButton);
      if (isUpOrDownEvent) {
        event.stopPropagation();
        instance.show();
        instance._selectMenuItem(event);
        return;
      }
      if (instance._isShown()) {
        // else is escape and we check if it is shown
        event.stopPropagation();
        instance.hide();
        getToggleButton.focus();
      }
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(document, EVENT_KEYDOWN_DATA_API, SELECTOR_DATA_TOGGLE$3, Dropdown.dataApiKeydownHandler);
  EventHandler.on(document, EVENT_KEYDOWN_DATA_API, SELECTOR_MENU, Dropdown.dataApiKeydownHandler);
  EventHandler.on(document, EVENT_CLICK_DATA_API$3, Dropdown.clearMenus);
  EventHandler.on(document, EVENT_KEYUP_DATA_API, Dropdown.clearMenus);
  EventHandler.on(document, EVENT_CLICK_DATA_API$3, SELECTOR_DATA_TOGGLE$3, function (event) {
    event.preventDefault();
    Dropdown.getOrCreateInstance(this).toggle();
  });

  /**
   * jQuery
   */

  defineJQueryPlugin(Dropdown);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/scrollBar.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const SELECTOR_FIXED_CONTENT = '.fixed-top, .fixed-bottom, .is-fixed, .sticky-top';
  const SELECTOR_STICKY_CONTENT = '.sticky-top';
  const PROPERTY_PADDING = 'padding-right';
  const PROPERTY_MARGIN = 'margin-right';

  /**
   * Class definition
   */

  class ScrollBarHelper {
    constructor() {
      this._element = document.body;
    }

    // Public
    getWidth() {
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/innerWidth#usage_notes
      const documentWidth = document.documentElement.clientWidth;
      return Math.abs(window.innerWidth - documentWidth);
    }
    hide() {
      const width = this.getWidth();
      this._disableOverFlow();
      // give padding to element to balance the hidden scrollbar width
      this._setElementAttributes(this._element, PROPERTY_PADDING, calculatedValue => calculatedValue + width);
      // trick: We adjust positive paddingRight and negative marginRight to sticky-top elements to keep showing fullwidth
      this._setElementAttributes(SELECTOR_FIXED_CONTENT, PROPERTY_PADDING, calculatedValue => calculatedValue + width);
      this._setElementAttributes(SELECTOR_STICKY_CONTENT, PROPERTY_MARGIN, calculatedValue => calculatedValue - width);
    }
    reset() {
      this._resetElementAttributes(this._element, 'overflow');
      this._resetElementAttributes(this._element, PROPERTY_PADDING);
      this._resetElementAttributes(SELECTOR_FIXED_CONTENT, PROPERTY_PADDING);
      this._resetElementAttributes(SELECTOR_STICKY_CONTENT, PROPERTY_MARGIN);
    }
    isOverflowing() {
      return this.getWidth() > 0;
    }

    // Private
    _disableOverFlow() {
      this._saveInitialAttribute(this._element, 'overflow');
      this._element.style.overflow = 'hidden';
    }
    _setElementAttributes(selector, styleProperty, callback) {
      const scrollbarWidth = this.getWidth();
      const manipulationCallBack = element => {
        if (element !== this._element && window.innerWidth > element.clientWidth + scrollbarWidth) {
          return;
        }
        this._saveInitialAttribute(element, styleProperty);
        const calculatedValue = window.getComputedStyle(element).getPropertyValue(styleProperty);
        element.style.setProperty(styleProperty, `${callback(Number.parseFloat(calculatedValue))}px`);
      };
      this._applyManipulationCallback(selector, manipulationCallBack);
    }
    _saveInitialAttribute(element, styleProperty) {
      const actualValue = element.style.getPropertyValue(styleProperty);
      if (actualValue) {
        Manipulator.setDataAttribute(element, styleProperty, actualValue);
      }
    }
    _resetElementAttributes(selector, styleProperty) {
      const manipulationCallBack = element => {
        const value = Manipulator.getDataAttribute(element, styleProperty);
        // We only want to remove the property if the value is `null`; the value can also be zero
        if (value === null) {
          element.style.removeProperty(styleProperty);
          return;
        }
        Manipulator.removeDataAttribute(element, styleProperty);
        element.style.setProperty(styleProperty, value);
      };
      this._applyManipulationCallback(selector, manipulationCallBack);
    }
    _applyManipulationCallback(selector, callBack) {
      if (isElement$2(selector)) {
        callBack(selector);
        return;
      }
      for (const sel of SelectorEngine.find(selector, this._element)) {
        callBack(sel);
      }
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/backdrop.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$9 = 'backdrop';
  const CLASS_NAME_FADE$4 = 'fade';
  const CLASS_NAME_SHOW$5 = 'show';
  const EVENT_MOUSEDOWN = `mousedown.bs.${NAME$9}`;
  const Default$8 = {
    className: 'modal-backdrop',
    clickCallback: null,
    isAnimated: false,
    isVisible: true,
    // if false, we use the backdrop helper without adding any element to the dom
    rootElement: 'body' // give the choice to place backdrop under different elements
  };

  const DefaultType$8 = {
    className: 'string',
    clickCallback: '(function|null)',
    isAnimated: 'boolean',
    isVisible: 'boolean',
    rootElement: '(element|string)'
  };

  /**
   * Class definition
   */

  class Backdrop extends Config$1 {
    constructor(config) {
      super();
      this._config = this._getConfig(config);
      this._isAppended = false;
      this._element = null;
    }

    // Getters
    static get Default() {
      return Default$8;
    }
    static get DefaultType() {
      return DefaultType$8;
    }
    static get NAME() {
      return NAME$9;
    }

    // Public
    show(callback) {
      if (!this._config.isVisible) {
        execute(callback);
        return;
      }
      this._append();
      const element = this._getElement();
      if (this._config.isAnimated) {
        reflow(element);
      }
      element.classList.add(CLASS_NAME_SHOW$5);
      this._emulateAnimation(() => {
        execute(callback);
      });
    }
    hide(callback) {
      if (!this._config.isVisible) {
        execute(callback);
        return;
      }
      this._getElement().classList.remove(CLASS_NAME_SHOW$5);
      this._emulateAnimation(() => {
        this.dispose();
        execute(callback);
      });
    }
    dispose() {
      if (!this._isAppended) {
        return;
      }
      EventHandler.off(this._element, EVENT_MOUSEDOWN);
      this._element.remove();
      this._isAppended = false;
    }

    // Private
    _getElement() {
      if (!this._element) {
        const backdrop = document.createElement('div');
        backdrop.className = this._config.className;
        if (this._config.isAnimated) {
          backdrop.classList.add(CLASS_NAME_FADE$4);
        }
        this._element = backdrop;
      }
      return this._element;
    }
    _configAfterMerge(config) {
      // use getElement() with the default "body" to get a fresh Element on each instantiation
      config.rootElement = getElement(config.rootElement);
      return config;
    }
    _append() {
      if (this._isAppended) {
        return;
      }
      const element = this._getElement();
      this._config.rootElement.append(element);
      EventHandler.on(element, EVENT_MOUSEDOWN, () => {
        execute(this._config.clickCallback);
      });
      this._isAppended = true;
    }
    _emulateAnimation(callback) {
      executeAfterTransition(callback, this._getElement(), this._config.isAnimated);
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/focustrap.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$8 = 'focustrap';
  const DATA_KEY$5 = 'bs.focustrap';
  const EVENT_KEY$5 = `.${DATA_KEY$5}`;
  const EVENT_FOCUSIN$2 = `focusin${EVENT_KEY$5}`;
  const EVENT_KEYDOWN_TAB = `keydown.tab${EVENT_KEY$5}`;
  const TAB_KEY = 'Tab';
  const TAB_NAV_FORWARD = 'forward';
  const TAB_NAV_BACKWARD = 'backward';
  const Default$7 = {
    autofocus: true,
    trapElement: null // The element to trap focus inside of
  };

  const DefaultType$7 = {
    autofocus: 'boolean',
    trapElement: 'element'
  };

  /**
   * Class definition
   */

  class FocusTrap extends Config$1 {
    constructor(config) {
      super();
      this._config = this._getConfig(config);
      this._isActive = false;
      this._lastTabNavDirection = null;
    }

    // Getters
    static get Default() {
      return Default$7;
    }
    static get DefaultType() {
      return DefaultType$7;
    }
    static get NAME() {
      return NAME$8;
    }

    // Public
    activate() {
      if (this._isActive) {
        return;
      }
      if (this._config.autofocus) {
        this._config.trapElement.focus();
      }
      EventHandler.off(document, EVENT_KEY$5); // guard against infinite focus loop
      EventHandler.on(document, EVENT_FOCUSIN$2, event => this._handleFocusin(event));
      EventHandler.on(document, EVENT_KEYDOWN_TAB, event => this._handleKeydown(event));
      this._isActive = true;
    }
    deactivate() {
      if (!this._isActive) {
        return;
      }
      this._isActive = false;
      EventHandler.off(document, EVENT_KEY$5);
    }

    // Private
    _handleFocusin(event) {
      const {
        trapElement
      } = this._config;
      if (event.target === document || event.target === trapElement || trapElement.contains(event.target)) {
        return;
      }
      const elements = SelectorEngine.focusableChildren(trapElement);
      if (elements.length === 0) {
        trapElement.focus();
      } else if (this._lastTabNavDirection === TAB_NAV_BACKWARD) {
        elements[elements.length - 1].focus();
      } else {
        elements[0].focus();
      }
    }
    _handleKeydown(event) {
      if (event.key !== TAB_KEY) {
        return;
      }
      this._lastTabNavDirection = event.shiftKey ? TAB_NAV_BACKWARD : TAB_NAV_FORWARD;
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): modal.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$7 = 'modal';
  const DATA_KEY$4 = 'bs.modal';
  const EVENT_KEY$4 = `.${DATA_KEY$4}`;
  const DATA_API_KEY$2 = '.data-api';
  const ESCAPE_KEY$1 = 'Escape';
  const EVENT_HIDE$4 = `hide${EVENT_KEY$4}`;
  const EVENT_HIDE_PREVENTED$1 = `hidePrevented${EVENT_KEY$4}`;
  const EVENT_HIDDEN$4 = `hidden${EVENT_KEY$4}`;
  const EVENT_SHOW$4 = `show${EVENT_KEY$4}`;
  const EVENT_SHOWN$4 = `shown${EVENT_KEY$4}`;
  const EVENT_RESIZE$1 = `resize${EVENT_KEY$4}`;
  const EVENT_CLICK_DISMISS = `click.dismiss${EVENT_KEY$4}`;
  const EVENT_MOUSEDOWN_DISMISS = `mousedown.dismiss${EVENT_KEY$4}`;
  const EVENT_KEYDOWN_DISMISS$1 = `keydown.dismiss${EVENT_KEY$4}`;
  const EVENT_CLICK_DATA_API$2 = `click${EVENT_KEY$4}${DATA_API_KEY$2}`;
  const CLASS_NAME_OPEN = 'modal-open';
  const CLASS_NAME_FADE$3 = 'fade';
  const CLASS_NAME_SHOW$4 = 'show';
  const CLASS_NAME_STATIC = 'modal-static';
  const OPEN_SELECTOR$1 = '.modal.show';
  const SELECTOR_DIALOG = '.modal-dialog';
  const SELECTOR_MODAL_BODY = '.modal-body';
  const SELECTOR_DATA_TOGGLE$2 = '[data-bs-toggle="modal"]';
  const Default$6 = {
    backdrop: true,
    focus: true,
    keyboard: true
  };
  const DefaultType$6 = {
    backdrop: '(boolean|string)',
    focus: 'boolean',
    keyboard: 'boolean'
  };

  /**
   * Class definition
   */

  class Modal extends BaseComponent {
    constructor(element, config) {
      super(element, config);
      this._dialog = SelectorEngine.findOne(SELECTOR_DIALOG, this._element);
      this._backdrop = this._initializeBackDrop();
      this._focustrap = this._initializeFocusTrap();
      this._isShown = false;
      this._isTransitioning = false;
      this._scrollBar = new ScrollBarHelper();
      this._addEventListeners();
    }

    // Getters
    static get Default() {
      return Default$6;
    }
    static get DefaultType() {
      return DefaultType$6;
    }
    static get NAME() {
      return NAME$7;
    }

    // Public
    toggle(relatedTarget) {
      return this._isShown ? this.hide() : this.show(relatedTarget);
    }
    show(relatedTarget) {
      if (this._isShown || this._isTransitioning) {
        return;
      }
      const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$4, {
        relatedTarget
      });
      if (showEvent.defaultPrevented) {
        return;
      }
      this._isShown = true;
      this._isTransitioning = true;
      this._scrollBar.hide();
      document.body.classList.add(CLASS_NAME_OPEN);
      this._adjustDialog();
      this._backdrop.show(() => this._showElement(relatedTarget));
    }
    hide() {
      if (!this._isShown || this._isTransitioning) {
        return;
      }
      const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$4);
      if (hideEvent.defaultPrevented) {
        return;
      }
      this._isShown = false;
      this._isTransitioning = true;
      this._focustrap.deactivate();
      this._element.classList.remove(CLASS_NAME_SHOW$4);
      this._queueCallback(() => this._hideModal(), this._element, this._isAnimated());
    }
    dispose() {
      for (const htmlElement of [window, this._dialog]) {
        EventHandler.off(htmlElement, EVENT_KEY$4);
      }
      this._backdrop.dispose();
      this._focustrap.deactivate();
      super.dispose();
    }
    handleUpdate() {
      this._adjustDialog();
    }

    // Private
    _initializeBackDrop() {
      return new Backdrop({
        isVisible: Boolean(this._config.backdrop),
        // 'static' option will be translated to true, and booleans will keep their value,
        isAnimated: this._isAnimated()
      });
    }
    _initializeFocusTrap() {
      return new FocusTrap({
        trapElement: this._element
      });
    }
    _showElement(relatedTarget) {
      // try to append dynamic modal
      if (!document.body.contains(this._element)) {
        document.body.append(this._element);
      }
      this._element.style.display = 'block';
      this._element.removeAttribute('aria-hidden');
      this._element.setAttribute('aria-modal', true);
      this._element.setAttribute('role', 'dialog');
      this._element.scrollTop = 0;
      const modalBody = SelectorEngine.findOne(SELECTOR_MODAL_BODY, this._dialog);
      if (modalBody) {
        modalBody.scrollTop = 0;
      }
      reflow(this._element);
      this._element.classList.add(CLASS_NAME_SHOW$4);
      const transitionComplete = () => {
        if (this._config.focus) {
          this._focustrap.activate();
        }
        this._isTransitioning = false;
        EventHandler.trigger(this._element, EVENT_SHOWN$4, {
          relatedTarget
        });
      };
      this._queueCallback(transitionComplete, this._dialog, this._isAnimated());
    }
    _addEventListeners() {
      EventHandler.on(this._element, EVENT_KEYDOWN_DISMISS$1, event => {
        if (event.key !== ESCAPE_KEY$1) {
          return;
        }
        if (this._config.keyboard) {
          event.preventDefault();
          this.hide();
          return;
        }
        this._triggerBackdropTransition();
      });
      EventHandler.on(window, EVENT_RESIZE$1, () => {
        if (this._isShown && !this._isTransitioning) {
          this._adjustDialog();
        }
      });
      EventHandler.on(this._element, EVENT_MOUSEDOWN_DISMISS, event => {
        // a bad trick to segregate clicks that may start inside dialog but end outside, and avoid listen to scrollbar clicks
        EventHandler.one(this._element, EVENT_CLICK_DISMISS, event2 => {
          if (this._element !== event.target || this._element !== event2.target) {
            return;
          }
          if (this._config.backdrop === 'static') {
            this._triggerBackdropTransition();
            return;
          }
          if (this._config.backdrop) {
            this.hide();
          }
        });
      });
    }
    _hideModal() {
      this._element.style.display = 'none';
      this._element.setAttribute('aria-hidden', true);
      this._element.removeAttribute('aria-modal');
      this._element.removeAttribute('role');
      this._isTransitioning = false;
      this._backdrop.hide(() => {
        document.body.classList.remove(CLASS_NAME_OPEN);
        this._resetAdjustments();
        this._scrollBar.reset();
        EventHandler.trigger(this._element, EVENT_HIDDEN$4);
      });
    }
    _isAnimated() {
      return this._element.classList.contains(CLASS_NAME_FADE$3);
    }
    _triggerBackdropTransition() {
      const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED$1);
      if (hideEvent.defaultPrevented) {
        return;
      }
      const isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;
      const initialOverflowY = this._element.style.overflowY;
      // return if the following background transition hasn't yet completed
      if (initialOverflowY === 'hidden' || this._element.classList.contains(CLASS_NAME_STATIC)) {
        return;
      }
      if (!isModalOverflowing) {
        this._element.style.overflowY = 'hidden';
      }
      this._element.classList.add(CLASS_NAME_STATIC);
      this._queueCallback(() => {
        this._element.classList.remove(CLASS_NAME_STATIC);
        this._queueCallback(() => {
          this._element.style.overflowY = initialOverflowY;
        }, this._dialog);
      }, this._dialog);
      this._element.focus();
    }

    /**
     * The following methods are used to handle overflowing modals
     */

    _adjustDialog() {
      const isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;
      const scrollbarWidth = this._scrollBar.getWidth();
      const isBodyOverflowing = scrollbarWidth > 0;
      if (isBodyOverflowing && !isModalOverflowing) {
        const property = isRTL() ? 'paddingLeft' : 'paddingRight';
        this._element.style[property] = `${scrollbarWidth}px`;
      }
      if (!isBodyOverflowing && isModalOverflowing) {
        const property = isRTL() ? 'paddingRight' : 'paddingLeft';
        this._element.style[property] = `${scrollbarWidth}px`;
      }
    }
    _resetAdjustments() {
      this._element.style.paddingLeft = '';
      this._element.style.paddingRight = '';
    }

    // Static
    static jQueryInterface(config, relatedTarget) {
      return this.each(function () {
        const data = Modal.getOrCreateInstance(this, config);
        if (typeof config !== 'string') {
          return;
        }
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config](relatedTarget);
      });
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(document, EVENT_CLICK_DATA_API$2, SELECTOR_DATA_TOGGLE$2, function (event) {
    const target = SelectorEngine.getElementFromSelector(this);
    if (['A', 'AREA'].includes(this.tagName)) {
      event.preventDefault();
    }
    EventHandler.one(target, EVENT_SHOW$4, showEvent => {
      if (showEvent.defaultPrevented) {
        // only register focus restorer if modal will actually get shown
        return;
      }
      EventHandler.one(target, EVENT_HIDDEN$4, () => {
        if (isVisible(this)) {
          this.focus();
        }
      });
    });

    // avoid conflict when clicking modal toggler while another one is open
    const alreadyOpen = SelectorEngine.findOne(OPEN_SELECTOR$1);
    if (alreadyOpen) {
      Modal.getInstance(alreadyOpen).hide();
    }
    const data = Modal.getOrCreateInstance(target);
    data.toggle(this);
  });
  enableDismissTrigger(Modal);

  /**
   * jQuery
   */

  defineJQueryPlugin(Modal);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): offcanvas.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$6 = 'offcanvas';
  const DATA_KEY$3 = 'bs.offcanvas';
  const EVENT_KEY$3 = `.${DATA_KEY$3}`;
  const DATA_API_KEY$1 = '.data-api';
  const EVENT_LOAD_DATA_API$2 = `load${EVENT_KEY$3}${DATA_API_KEY$1}`;
  const ESCAPE_KEY = 'Escape';
  const CLASS_NAME_SHOW$3 = 'show';
  const CLASS_NAME_SHOWING$1 = 'showing';
  const CLASS_NAME_HIDING = 'hiding';
  const CLASS_NAME_BACKDROP = 'offcanvas-backdrop';
  const OPEN_SELECTOR = '.offcanvas.show';
  const EVENT_SHOW$3 = `show${EVENT_KEY$3}`;
  const EVENT_SHOWN$3 = `shown${EVENT_KEY$3}`;
  const EVENT_HIDE$3 = `hide${EVENT_KEY$3}`;
  const EVENT_HIDE_PREVENTED = `hidePrevented${EVENT_KEY$3}`;
  const EVENT_HIDDEN$3 = `hidden${EVENT_KEY$3}`;
  const EVENT_RESIZE = `resize${EVENT_KEY$3}`;
  const EVENT_CLICK_DATA_API$1 = `click${EVENT_KEY$3}${DATA_API_KEY$1}`;
  const EVENT_KEYDOWN_DISMISS = `keydown.dismiss${EVENT_KEY$3}`;
  const SELECTOR_DATA_TOGGLE$1 = '[data-bs-toggle="offcanvas"]';
  const Default$5 = {
    backdrop: true,
    keyboard: true,
    scroll: false
  };
  const DefaultType$5 = {
    backdrop: '(boolean|string)',
    keyboard: 'boolean',
    scroll: 'boolean'
  };

  /**
   * Class definition
   */

  class Offcanvas extends BaseComponent {
    constructor(element, config) {
      super(element, config);
      this._isShown = false;
      this._backdrop = this._initializeBackDrop();
      this._focustrap = this._initializeFocusTrap();
      this._addEventListeners();
    }

    // Getters
    static get Default() {
      return Default$5;
    }
    static get DefaultType() {
      return DefaultType$5;
    }
    static get NAME() {
      return NAME$6;
    }

    // Public
    toggle(relatedTarget) {
      return this._isShown ? this.hide() : this.show(relatedTarget);
    }
    show(relatedTarget) {
      if (this._isShown) {
        return;
      }
      const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$3, {
        relatedTarget
      });
      if (showEvent.defaultPrevented) {
        return;
      }
      this._isShown = true;
      this._backdrop.show();
      if (!this._config.scroll) {
        new ScrollBarHelper().hide();
      }
      this._element.setAttribute('aria-modal', true);
      this._element.setAttribute('role', 'dialog');
      this._element.classList.add(CLASS_NAME_SHOWING$1);
      const completeCallBack = () => {
        if (!this._config.scroll || this._config.backdrop) {
          this._focustrap.activate();
        }
        this._element.classList.add(CLASS_NAME_SHOW$3);
        this._element.classList.remove(CLASS_NAME_SHOWING$1);
        EventHandler.trigger(this._element, EVENT_SHOWN$3, {
          relatedTarget
        });
      };
      this._queueCallback(completeCallBack, this._element, true);
    }
    hide() {
      if (!this._isShown) {
        return;
      }
      const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$3);
      if (hideEvent.defaultPrevented) {
        return;
      }
      this._focustrap.deactivate();
      this._element.blur();
      this._isShown = false;
      this._element.classList.add(CLASS_NAME_HIDING);
      this._backdrop.hide();
      const completeCallback = () => {
        this._element.classList.remove(CLASS_NAME_SHOW$3, CLASS_NAME_HIDING);
        this._element.removeAttribute('aria-modal');
        this._element.removeAttribute('role');
        if (!this._config.scroll) {
          new ScrollBarHelper().reset();
        }
        EventHandler.trigger(this._element, EVENT_HIDDEN$3);
      };
      this._queueCallback(completeCallback, this._element, true);
    }
    dispose() {
      this._backdrop.dispose();
      this._focustrap.deactivate();
      super.dispose();
    }

    // Private
    _initializeBackDrop() {
      const clickCallback = () => {
        if (this._config.backdrop === 'static') {
          EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED);
          return;
        }
        this.hide();
      };

      // 'static' option will be translated to true, and booleans will keep their value
      const isVisible = Boolean(this._config.backdrop);
      return new Backdrop({
        className: CLASS_NAME_BACKDROP,
        isVisible,
        isAnimated: true,
        rootElement: this._element.parentNode,
        clickCallback: isVisible ? clickCallback : null
      });
    }
    _initializeFocusTrap() {
      return new FocusTrap({
        trapElement: this._element
      });
    }
    _addEventListeners() {
      EventHandler.on(this._element, EVENT_KEYDOWN_DISMISS, event => {
        if (event.key !== ESCAPE_KEY) {
          return;
        }
        if (!this._config.keyboard) {
          EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED);
          return;
        }
        this.hide();
      });
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Offcanvas.getOrCreateInstance(this, config);
        if (typeof config !== 'string') {
          return;
        }
        if (data[config] === undefined || config.startsWith('_') || config === 'constructor') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config](this);
      });
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(document, EVENT_CLICK_DATA_API$1, SELECTOR_DATA_TOGGLE$1, function (event) {
    const target = SelectorEngine.getElementFromSelector(this);
    if (['A', 'AREA'].includes(this.tagName)) {
      event.preventDefault();
    }
    if (isDisabled(this)) {
      return;
    }
    EventHandler.one(target, EVENT_HIDDEN$3, () => {
      // focus on trigger when it is closed
      if (isVisible(this)) {
        this.focus();
      }
    });

    // avoid conflict when clicking a toggler of an offcanvas, while another is open
    const alreadyOpen = SelectorEngine.findOne(OPEN_SELECTOR);
    if (alreadyOpen && alreadyOpen !== target) {
      Offcanvas.getInstance(alreadyOpen).hide();
    }
    const data = Offcanvas.getOrCreateInstance(target);
    data.toggle(this);
  });
  EventHandler.on(window, EVENT_LOAD_DATA_API$2, () => {
    for (const selector of SelectorEngine.find(OPEN_SELECTOR)) {
      Offcanvas.getOrCreateInstance(selector).show();
    }
  });
  EventHandler.on(window, EVENT_RESIZE, () => {
    for (const element of SelectorEngine.find('[aria-modal][class*=show][class*=offcanvas-]')) {
      if (getComputedStyle(element).position !== 'fixed') {
        Offcanvas.getOrCreateInstance(element).hide();
      }
    }
  });
  enableDismissTrigger(Offcanvas);

  /**
   * jQuery
   */

  defineJQueryPlugin(Offcanvas);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/sanitizer.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  const uriAttributes = new Set(['background', 'cite', 'href', 'itemtype', 'longdesc', 'poster', 'src', 'xlink:href']);
  const ARIA_ATTRIBUTE_PATTERN = /^aria-[\w-]*$/i;

  /**
   * A pattern that recognizes a commonly useful subset of URLs that are safe.
   *
   * Shout-out to Angular https://github.com/angular/angular/blob/12.2.x/packages/core/src/sanitization/url_sanitizer.ts
   */
  const SAFE_URL_PATTERN = /^(?:(?:https?|mailto|ftp|tel|file|sms):|[^#&/:?]*(?:[#/?]|$))/i;

  /**
   * A pattern that matches safe data URLs. Only matches image, video and audio types.
   *
   * Shout-out to Angular https://github.com/angular/angular/blob/12.2.x/packages/core/src/sanitization/url_sanitizer.ts
   */
  const DATA_URL_PATTERN = /^data:(?:image\/(?:bmp|gif|jpeg|jpg|png|tiff|webp)|video\/(?:mpeg|mp4|ogg|webm)|audio\/(?:mp3|oga|ogg|opus));base64,[\d+/a-z]+=*$/i;
  const allowedAttribute = (attribute, allowedAttributeList) => {
    const attributeName = attribute.nodeName.toLowerCase();
    if (allowedAttributeList.includes(attributeName)) {
      if (uriAttributes.has(attributeName)) {
        return Boolean(SAFE_URL_PATTERN.test(attribute.nodeValue) || DATA_URL_PATTERN.test(attribute.nodeValue));
      }
      return true;
    }

    // Check if a regular expression validates the attribute.
    return allowedAttributeList.filter(attributeRegex => attributeRegex instanceof RegExp).some(regex => regex.test(attributeName));
  };
  const DefaultAllowlist = {
    // Global attributes allowed on any supplied element below.
    '*': ['class', 'dir', 'id', 'lang', 'role', ARIA_ATTRIBUTE_PATTERN],
    a: ['target', 'href', 'title', 'rel'],
    area: [],
    b: [],
    br: [],
    col: [],
    code: [],
    div: [],
    em: [],
    hr: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    i: [],
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height'],
    li: [],
    ol: [],
    p: [],
    pre: [],
    s: [],
    small: [],
    span: [],
    sub: [],
    sup: [],
    strong: [],
    u: [],
    ul: []
  };
  function sanitizeHtml(unsafeHtml, allowList, sanitizeFunction) {
    if (!unsafeHtml.length) {
      return unsafeHtml;
    }
    if (sanitizeFunction && typeof sanitizeFunction === 'function') {
      return sanitizeFunction(unsafeHtml);
    }
    const domParser = new window.DOMParser();
    const createdDocument = domParser.parseFromString(unsafeHtml, 'text/html');
    const elements = [].concat(...createdDocument.body.querySelectorAll('*'));
    for (const element of elements) {
      const elementName = element.nodeName.toLowerCase();
      if (!Object.keys(allowList).includes(elementName)) {
        element.remove();
        continue;
      }
      const attributeList = [].concat(...element.attributes);
      const allowedAttributes = [].concat(allowList['*'] || [], allowList[elementName] || []);
      for (const attribute of attributeList) {
        if (!allowedAttribute(attribute, allowedAttributes)) {
          element.removeAttribute(attribute.nodeName);
        }
      }
    }
    return createdDocument.body.innerHTML;
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): util/template-factory.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$5 = 'TemplateFactory';
  const Default$4 = {
    allowList: DefaultAllowlist,
    content: {},
    // { selector : text ,  selector2 : text2 , }
    extraClass: '',
    html: false,
    sanitize: true,
    sanitizeFn: null,
    template: '<div></div>'
  };
  const DefaultType$4 = {
    allowList: 'object',
    content: 'object',
    extraClass: '(string|function)',
    html: 'boolean',
    sanitize: 'boolean',
    sanitizeFn: '(null|function)',
    template: 'string'
  };
  const DefaultContentType = {
    entry: '(string|element|function|null)',
    selector: '(string|element)'
  };

  /**
   * Class definition
   */

  class TemplateFactory extends Config$1 {
    constructor(config) {
      super();
      this._config = this._getConfig(config);
    }

    // Getters
    static get Default() {
      return Default$4;
    }
    static get DefaultType() {
      return DefaultType$4;
    }
    static get NAME() {
      return NAME$5;
    }

    // Public
    getContent() {
      return Object.values(this._config.content).map(config => this._resolvePossibleFunction(config)).filter(Boolean);
    }
    hasContent() {
      return this.getContent().length > 0;
    }
    changeContent(content) {
      this._checkContent(content);
      this._config.content = {
        ...this._config.content,
        ...content
      };
      return this;
    }
    toHtml() {
      const templateWrapper = document.createElement('div');
      templateWrapper.innerHTML = this._maybeSanitize(this._config.template);
      for (const [selector, text] of Object.entries(this._config.content)) {
        this._setContent(templateWrapper, text, selector);
      }
      const template = templateWrapper.children[0];
      const extraClass = this._resolvePossibleFunction(this._config.extraClass);
      if (extraClass) {
        template.classList.add(...extraClass.split(' '));
      }
      return template;
    }

    // Private
    _typeCheckConfig(config) {
      super._typeCheckConfig(config);
      this._checkContent(config.content);
    }
    _checkContent(arg) {
      for (const [selector, content] of Object.entries(arg)) {
        super._typeCheckConfig({
          selector,
          entry: content
        }, DefaultContentType);
      }
    }
    _setContent(template, content, selector) {
      const templateElement = SelectorEngine.findOne(selector, template);
      if (!templateElement) {
        return;
      }
      content = this._resolvePossibleFunction(content);
      if (!content) {
        templateElement.remove();
        return;
      }
      if (isElement$2(content)) {
        this._putElementInTemplate(getElement(content), templateElement);
        return;
      }
      if (this._config.html) {
        templateElement.innerHTML = this._maybeSanitize(content);
        return;
      }
      templateElement.textContent = content;
    }
    _maybeSanitize(arg) {
      return this._config.sanitize ? sanitizeHtml(arg, this._config.allowList, this._config.sanitizeFn) : arg;
    }
    _resolvePossibleFunction(arg) {
      return execute(arg, [this]);
    }
    _putElementInTemplate(element, templateElement) {
      if (this._config.html) {
        templateElement.innerHTML = '';
        templateElement.append(element);
        return;
      }
      templateElement.textContent = element.textContent;
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): tooltip.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$4 = 'tooltip';
  const DISALLOWED_ATTRIBUTES = new Set(['sanitize', 'allowList', 'sanitizeFn']);
  const CLASS_NAME_FADE$2 = 'fade';
  const CLASS_NAME_MODAL = 'modal';
  const CLASS_NAME_SHOW$2 = 'show';
  const SELECTOR_TOOLTIP_INNER = '.tooltip-inner';
  const SELECTOR_MODAL = `.${CLASS_NAME_MODAL}`;
  const EVENT_MODAL_HIDE = 'hide.bs.modal';
  const TRIGGER_HOVER = 'hover';
  const TRIGGER_FOCUS = 'focus';
  const TRIGGER_CLICK = 'click';
  const TRIGGER_MANUAL = 'manual';
  const EVENT_HIDE$2 = 'hide';
  const EVENT_HIDDEN$2 = 'hidden';
  const EVENT_SHOW$2 = 'show';
  const EVENT_SHOWN$2 = 'shown';
  const EVENT_INSERTED = 'inserted';
  const EVENT_CLICK$1 = 'click';
  const EVENT_FOCUSIN$1 = 'focusin';
  const EVENT_FOCUSOUT$1 = 'focusout';
  const EVENT_MOUSEENTER = 'mouseenter';
  const EVENT_MOUSELEAVE = 'mouseleave';
  const AttachmentMap = {
    AUTO: 'auto',
    TOP: 'top',
    RIGHT: isRTL() ? 'left' : 'right',
    BOTTOM: 'bottom',
    LEFT: isRTL() ? 'right' : 'left'
  };
  const Default$3 = {
    allowList: DefaultAllowlist,
    animation: true,
    boundary: 'clippingParents',
    container: false,
    customClass: '',
    delay: 0,
    fallbackPlacements: ['top', 'right', 'bottom', 'left'],
    html: false,
    offset: [0, 0],
    placement: 'top',
    popperConfig: null,
    sanitize: true,
    sanitizeFn: null,
    selector: false,
    template: '<div class="tooltip" role="tooltip">' + '<div class="tooltip-arrow"></div>' + '<div class="tooltip-inner"></div>' + '</div>',
    title: '',
    trigger: 'hover focus'
  };
  const DefaultType$3 = {
    allowList: 'object',
    animation: 'boolean',
    boundary: '(string|element)',
    container: '(string|element|boolean)',
    customClass: '(string|function)',
    delay: '(number|object)',
    fallbackPlacements: 'array',
    html: 'boolean',
    offset: '(array|string|function)',
    placement: '(string|function)',
    popperConfig: '(null|object|function)',
    sanitize: 'boolean',
    sanitizeFn: '(null|function)',
    selector: '(string|boolean)',
    template: 'string',
    title: '(string|element|function)',
    trigger: 'string'
  };

  /**
   * Class definition
   */

  class Tooltip extends BaseComponent {
    constructor(element, config) {
      if (typeof Popper === 'undefined') {
        throw new TypeError('Bootstrap\'s tooltips require Popper (https://popper.js.org)');
      }
      super(element, config);

      // Private
      this._isEnabled = true;
      this._timeout = 0;
      this._isHovered = null;
      this._activeTrigger = {};
      this._popper = null;
      this._templateFactory = null;
      this._newContent = null;

      // Protected
      this.tip = null;
      this._setListeners();
      if (!this._config.selector) {
        this._fixTitle();
      }
    }

    // Getters
    static get Default() {
      return Default$3;
    }
    static get DefaultType() {
      return DefaultType$3;
    }
    static get NAME() {
      return NAME$4;
    }

    // Public
    enable() {
      this._isEnabled = true;
    }
    disable() {
      this._isEnabled = false;
    }
    toggleEnabled() {
      this._isEnabled = !this._isEnabled;
    }
    toggle() {
      if (!this._isEnabled) {
        return;
      }
      this._activeTrigger.click = !this._activeTrigger.click;
      if (this._isShown()) {
        this._leave();
        return;
      }
      this._enter();
    }
    dispose() {
      clearTimeout(this._timeout);
      EventHandler.off(this._element.closest(SELECTOR_MODAL), EVENT_MODAL_HIDE, this._hideModalHandler);
      if (this._element.getAttribute('data-bs-original-title')) {
        this._element.setAttribute('title', this._element.getAttribute('data-bs-original-title'));
      }
      this._disposePopper();
      super.dispose();
    }
    show() {
      if (this._element.style.display === 'none') {
        throw new Error('Please use show on visible elements');
      }
      if (!(this._isWithContent() && this._isEnabled)) {
        return;
      }
      const showEvent = EventHandler.trigger(this._element, this.constructor.eventName(EVENT_SHOW$2));
      const shadowRoot = findShadowRoot(this._element);
      const isInTheDom = (shadowRoot || this._element.ownerDocument.documentElement).contains(this._element);
      if (showEvent.defaultPrevented || !isInTheDom) {
        return;
      }

      // todo v6 remove this OR make it optional
      this._disposePopper();
      const tip = this._getTipElement();
      this._element.setAttribute('aria-describedby', tip.getAttribute('id'));
      const {
        container
      } = this._config;
      if (!this._element.ownerDocument.documentElement.contains(this.tip)) {
        container.append(tip);
        EventHandler.trigger(this._element, this.constructor.eventName(EVENT_INSERTED));
      }
      this._popper = this._createPopper(tip);
      tip.classList.add(CLASS_NAME_SHOW$2);

      // If this is a touch-enabled device we add extra
      // empty mouseover listeners to the body's immediate children;
      // only needed because of broken event delegation on iOS
      // https://www.quirksmode.org/blog/archives/2014/02/mouse_event_bub.html
      if ('ontouchstart' in document.documentElement) {
        for (const element of [].concat(...document.body.children)) {
          EventHandler.on(element, 'mouseover', noop$1);
        }
      }
      const complete = () => {
        EventHandler.trigger(this._element, this.constructor.eventName(EVENT_SHOWN$2));
        if (this._isHovered === false) {
          this._leave();
        }
        this._isHovered = false;
      };
      this._queueCallback(complete, this.tip, this._isAnimated());
    }
    hide() {
      if (!this._isShown()) {
        return;
      }
      const hideEvent = EventHandler.trigger(this._element, this.constructor.eventName(EVENT_HIDE$2));
      if (hideEvent.defaultPrevented) {
        return;
      }
      const tip = this._getTipElement();
      tip.classList.remove(CLASS_NAME_SHOW$2);

      // If this is a touch-enabled device we remove the extra
      // empty mouseover listeners we added for iOS support
      if ('ontouchstart' in document.documentElement) {
        for (const element of [].concat(...document.body.children)) {
          EventHandler.off(element, 'mouseover', noop$1);
        }
      }
      this._activeTrigger[TRIGGER_CLICK] = false;
      this._activeTrigger[TRIGGER_FOCUS] = false;
      this._activeTrigger[TRIGGER_HOVER] = false;
      this._isHovered = null; // it is a trick to support manual triggering

      const complete = () => {
        if (this._isWithActiveTrigger()) {
          return;
        }
        if (!this._isHovered) {
          this._disposePopper();
        }
        this._element.removeAttribute('aria-describedby');
        EventHandler.trigger(this._element, this.constructor.eventName(EVENT_HIDDEN$2));
      };
      this._queueCallback(complete, this.tip, this._isAnimated());
    }
    update() {
      if (this._popper) {
        this._popper.update();
      }
    }

    // Protected
    _isWithContent() {
      return Boolean(this._getTitle());
    }
    _getTipElement() {
      if (!this.tip) {
        this.tip = this._createTipElement(this._newContent || this._getContentForTemplate());
      }
      return this.tip;
    }
    _createTipElement(content) {
      const tip = this._getTemplateFactory(content).toHtml();

      // todo: remove this check on v6
      if (!tip) {
        return null;
      }
      tip.classList.remove(CLASS_NAME_FADE$2, CLASS_NAME_SHOW$2);
      // todo: on v6 the following can be achieved with CSS only
      tip.classList.add(`bs-${this.constructor.NAME}-auto`);
      const tipId = getUID(this.constructor.NAME).toString();
      tip.setAttribute('id', tipId);
      if (this._isAnimated()) {
        tip.classList.add(CLASS_NAME_FADE$2);
      }
      return tip;
    }
    setContent(content) {
      this._newContent = content;
      if (this._isShown()) {
        this._disposePopper();
        this.show();
      }
    }
    _getTemplateFactory(content) {
      if (this._templateFactory) {
        this._templateFactory.changeContent(content);
      } else {
        this._templateFactory = new TemplateFactory({
          ...this._config,
          // the `content` var has to be after `this._config`
          // to override config.content in case of popover
          content,
          extraClass: this._resolvePossibleFunction(this._config.customClass)
        });
      }
      return this._templateFactory;
    }
    _getContentForTemplate() {
      return {
        [SELECTOR_TOOLTIP_INNER]: this._getTitle()
      };
    }
    _getTitle() {
      return this._resolvePossibleFunction(this._config.title) || this._element.getAttribute('data-bs-original-title');
    }

    // Private
    _initializeOnDelegatedTarget(event) {
      return this.constructor.getOrCreateInstance(event.delegateTarget, this._getDelegateConfig());
    }
    _isAnimated() {
      return this._config.animation || this.tip && this.tip.classList.contains(CLASS_NAME_FADE$2);
    }
    _isShown() {
      return this.tip && this.tip.classList.contains(CLASS_NAME_SHOW$2);
    }
    _createPopper(tip) {
      const placement = execute(this._config.placement, [this, tip, this._element]);
      const attachment = AttachmentMap[placement.toUpperCase()];
      return createPopper(this._element, tip, this._getPopperConfig(attachment));
    }
    _getOffset() {
      const {
        offset
      } = this._config;
      if (typeof offset === 'string') {
        return offset.split(',').map(value => Number.parseInt(value, 10));
      }
      if (typeof offset === 'function') {
        return popperData => offset(popperData, this._element);
      }
      return offset;
    }
    _resolvePossibleFunction(arg) {
      return execute(arg, [this._element]);
    }
    _getPopperConfig(attachment) {
      const defaultBsPopperConfig = {
        placement: attachment,
        modifiers: [{
          name: 'flip',
          options: {
            fallbackPlacements: this._config.fallbackPlacements
          }
        }, {
          name: 'offset',
          options: {
            offset: this._getOffset()
          }
        }, {
          name: 'preventOverflow',
          options: {
            boundary: this._config.boundary
          }
        }, {
          name: 'arrow',
          options: {
            element: `.${this.constructor.NAME}-arrow`
          }
        }, {
          name: 'preSetPlacement',
          enabled: true,
          phase: 'beforeMain',
          fn: data => {
            // Pre-set Popper's placement attribute in order to read the arrow sizes properly.
            // Otherwise, Popper mixes up the width and height dimensions since the initial arrow style is for top placement
            this._getTipElement().setAttribute('data-popper-placement', data.state.placement);
          }
        }]
      };
      return {
        ...defaultBsPopperConfig,
        ...execute(this._config.popperConfig, [defaultBsPopperConfig])
      };
    }
    _setListeners() {
      const triggers = this._config.trigger.split(' ');
      for (const trigger of triggers) {
        if (trigger === 'click') {
          EventHandler.on(this._element, this.constructor.eventName(EVENT_CLICK$1), this._config.selector, event => {
            const context = this._initializeOnDelegatedTarget(event);
            context.toggle();
          });
        } else if (trigger !== TRIGGER_MANUAL) {
          const eventIn = trigger === TRIGGER_HOVER ? this.constructor.eventName(EVENT_MOUSEENTER) : this.constructor.eventName(EVENT_FOCUSIN$1);
          const eventOut = trigger === TRIGGER_HOVER ? this.constructor.eventName(EVENT_MOUSELEAVE) : this.constructor.eventName(EVENT_FOCUSOUT$1);
          EventHandler.on(this._element, eventIn, this._config.selector, event => {
            const context = this._initializeOnDelegatedTarget(event);
            context._activeTrigger[event.type === 'focusin' ? TRIGGER_FOCUS : TRIGGER_HOVER] = true;
            context._enter();
          });
          EventHandler.on(this._element, eventOut, this._config.selector, event => {
            const context = this._initializeOnDelegatedTarget(event);
            context._activeTrigger[event.type === 'focusout' ? TRIGGER_FOCUS : TRIGGER_HOVER] = context._element.contains(event.relatedTarget);
            context._leave();
          });
        }
      }
      this._hideModalHandler = () => {
        if (this._element) {
          this.hide();
        }
      };
      EventHandler.on(this._element.closest(SELECTOR_MODAL), EVENT_MODAL_HIDE, this._hideModalHandler);
    }
    _fixTitle() {
      const title = this._element.getAttribute('title');
      if (!title) {
        return;
      }
      if (!this._element.getAttribute('aria-label') && !this._element.textContent.trim()) {
        this._element.setAttribute('aria-label', title);
      }
      this._element.setAttribute('data-bs-original-title', title); // DO NOT USE IT. Is only for backwards compatibility
      this._element.removeAttribute('title');
    }
    _enter() {
      if (this._isShown() || this._isHovered) {
        this._isHovered = true;
        return;
      }
      this._isHovered = true;
      this._setTimeout(() => {
        if (this._isHovered) {
          this.show();
        }
      }, this._config.delay.show);
    }
    _leave() {
      if (this._isWithActiveTrigger()) {
        return;
      }
      this._isHovered = false;
      this._setTimeout(() => {
        if (!this._isHovered) {
          this.hide();
        }
      }, this._config.delay.hide);
    }
    _setTimeout(handler, timeout) {
      clearTimeout(this._timeout);
      this._timeout = setTimeout(handler, timeout);
    }
    _isWithActiveTrigger() {
      return Object.values(this._activeTrigger).includes(true);
    }
    _getConfig(config) {
      const dataAttributes = Manipulator.getDataAttributes(this._element);
      for (const dataAttribute of Object.keys(dataAttributes)) {
        if (DISALLOWED_ATTRIBUTES.has(dataAttribute)) {
          delete dataAttributes[dataAttribute];
        }
      }
      config = {
        ...dataAttributes,
        ...(typeof config === 'object' && config ? config : {})
      };
      config = this._mergeConfigObj(config);
      config = this._configAfterMerge(config);
      this._typeCheckConfig(config);
      return config;
    }
    _configAfterMerge(config) {
      config.container = config.container === false ? document.body : getElement(config.container);
      if (typeof config.delay === 'number') {
        config.delay = {
          show: config.delay,
          hide: config.delay
        };
      }
      if (typeof config.title === 'number') {
        config.title = config.title.toString();
      }
      if (typeof config.content === 'number') {
        config.content = config.content.toString();
      }
      return config;
    }
    _getDelegateConfig() {
      const config = {};
      for (const [key, value] of Object.entries(this._config)) {
        if (this.constructor.Default[key] !== value) {
          config[key] = value;
        }
      }
      config.selector = false;
      config.trigger = 'manual';

      // In the future can be replaced with:
      // const keysWithDifferentValues = Object.entries(this._config).filter(entry => this.constructor.Default[entry[0]] !== this._config[entry[0]])
      // `Object.fromEntries(keysWithDifferentValues)`
      return config;
    }
    _disposePopper() {
      if (this._popper) {
        this._popper.destroy();
        this._popper = null;
      }
      if (this.tip) {
        this.tip.remove();
        this.tip = null;
      }
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Tooltip.getOrCreateInstance(this, config);
        if (typeof config !== 'string') {
          return;
        }
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config]();
      });
    }
  }

  /**
   * jQuery
   */

  defineJQueryPlugin(Tooltip);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): popover.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$3 = 'popover';
  const SELECTOR_TITLE = '.popover-header';
  const SELECTOR_CONTENT = '.popover-body';
  const Default$2 = {
    ...Tooltip.Default,
    content: '',
    offset: [0, 8],
    placement: 'right',
    template: '<div class="popover" role="tooltip">' + '<div class="popover-arrow"></div>' + '<h3 class="popover-header"></h3>' + '<div class="popover-body"></div>' + '</div>',
    trigger: 'click'
  };
  const DefaultType$2 = {
    ...Tooltip.DefaultType,
    content: '(null|string|element|function)'
  };

  /**
   * Class definition
   */

  class Popover extends Tooltip {
    // Getters
    static get Default() {
      return Default$2;
    }
    static get DefaultType() {
      return DefaultType$2;
    }
    static get NAME() {
      return NAME$3;
    }

    // Overrides
    _isWithContent() {
      return this._getTitle() || this._getContent();
    }

    // Private
    _getContentForTemplate() {
      return {
        [SELECTOR_TITLE]: this._getTitle(),
        [SELECTOR_CONTENT]: this._getContent()
      };
    }
    _getContent() {
      return this._resolvePossibleFunction(this._config.content);
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Popover.getOrCreateInstance(this, config);
        if (typeof config !== 'string') {
          return;
        }
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config]();
      });
    }
  }

  /**
   * jQuery
   */

  defineJQueryPlugin(Popover);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): scrollspy.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$2 = 'scrollspy';
  const DATA_KEY$2 = 'bs.scrollspy';
  const EVENT_KEY$2 = `.${DATA_KEY$2}`;
  const DATA_API_KEY = '.data-api';
  const EVENT_ACTIVATE = `activate${EVENT_KEY$2}`;
  const EVENT_CLICK = `click${EVENT_KEY$2}`;
  const EVENT_LOAD_DATA_API$1 = `load${EVENT_KEY$2}${DATA_API_KEY}`;
  const CLASS_NAME_DROPDOWN_ITEM = 'dropdown-item';
  const CLASS_NAME_ACTIVE$1 = 'active';
  const SELECTOR_DATA_SPY = '[data-bs-spy="scroll"]';
  const SELECTOR_TARGET_LINKS = '[href]';
  const SELECTOR_NAV_LIST_GROUP = '.nav, .list-group';
  const SELECTOR_NAV_LINKS = '.nav-link';
  const SELECTOR_NAV_ITEMS = '.nav-item';
  const SELECTOR_LIST_ITEMS = '.list-group-item';
  const SELECTOR_LINK_ITEMS = `${SELECTOR_NAV_LINKS}, ${SELECTOR_NAV_ITEMS} > ${SELECTOR_NAV_LINKS}, ${SELECTOR_LIST_ITEMS}`;
  const SELECTOR_DROPDOWN = '.dropdown';
  const SELECTOR_DROPDOWN_TOGGLE$1 = '.dropdown-toggle';
  const Default$1 = {
    offset: null,
    // TODO: v6 @deprecated, keep it for backwards compatibility reasons
    rootMargin: '0px 0px -25%',
    smoothScroll: false,
    target: null,
    threshold: [0.1, 0.5, 1]
  };
  const DefaultType$1 = {
    offset: '(number|null)',
    // TODO v6 @deprecated, keep it for backwards compatibility reasons
    rootMargin: 'string',
    smoothScroll: 'boolean',
    target: 'element',
    threshold: 'array'
  };

  /**
   * Class definition
   */

  class ScrollSpy extends BaseComponent {
    constructor(element, config) {
      super(element, config);

      // this._element is the observablesContainer and config.target the menu links wrapper
      this._targetLinks = new Map();
      this._observableSections = new Map();
      this._rootElement = getComputedStyle(this._element).overflowY === 'visible' ? null : this._element;
      this._activeTarget = null;
      this._observer = null;
      this._previousScrollData = {
        visibleEntryTop: 0,
        parentScrollTop: 0
      };
      this.refresh(); // initialize
    }

    // Getters
    static get Default() {
      return Default$1;
    }
    static get DefaultType() {
      return DefaultType$1;
    }
    static get NAME() {
      return NAME$2;
    }

    // Public
    refresh() {
      this._initializeTargetsAndObservables();
      this._maybeEnableSmoothScroll();
      if (this._observer) {
        this._observer.disconnect();
      } else {
        this._observer = this._getNewObserver();
      }
      for (const section of this._observableSections.values()) {
        this._observer.observe(section);
      }
    }
    dispose() {
      this._observer.disconnect();
      super.dispose();
    }

    // Private
    _configAfterMerge(config) {
      // TODO: on v6 target should be given explicitly & remove the {target: 'ss-target'} case
      config.target = getElement(config.target) || document.body;

      // TODO: v6 Only for backwards compatibility reasons. Use rootMargin only
      config.rootMargin = config.offset ? `${config.offset}px 0px -30%` : config.rootMargin;
      if (typeof config.threshold === 'string') {
        config.threshold = config.threshold.split(',').map(value => Number.parseFloat(value));
      }
      return config;
    }
    _maybeEnableSmoothScroll() {
      if (!this._config.smoothScroll) {
        return;
      }

      // unregister any previous listeners
      EventHandler.off(this._config.target, EVENT_CLICK);
      EventHandler.on(this._config.target, EVENT_CLICK, SELECTOR_TARGET_LINKS, event => {
        const observableSection = this._observableSections.get(event.target.hash);
        if (observableSection) {
          event.preventDefault();
          const root = this._rootElement || window;
          const height = observableSection.offsetTop - this._element.offsetTop;
          if (root.scrollTo) {
            root.scrollTo({
              top: height,
              behavior: 'smooth'
            });
            return;
          }

          // Chrome 60 doesn't support `scrollTo`
          root.scrollTop = height;
        }
      });
    }
    _getNewObserver() {
      const options = {
        root: this._rootElement,
        threshold: this._config.threshold,
        rootMargin: this._config.rootMargin
      };
      return new IntersectionObserver(entries => this._observerCallback(entries), options);
    }

    // The logic of selection
    _observerCallback(entries) {
      const targetElement = entry => this._targetLinks.get(`#${entry.target.id}`);
      const activate = entry => {
        this._previousScrollData.visibleEntryTop = entry.target.offsetTop;
        this._process(targetElement(entry));
      };
      const parentScrollTop = (this._rootElement || document.documentElement).scrollTop;
      const userScrollsDown = parentScrollTop >= this._previousScrollData.parentScrollTop;
      this._previousScrollData.parentScrollTop = parentScrollTop;
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          this._activeTarget = null;
          this._clearActiveClass(targetElement(entry));
          continue;
        }
        const entryIsLowerThanPrevious = entry.target.offsetTop >= this._previousScrollData.visibleEntryTop;
        // if we are scrolling down, pick the bigger offsetTop
        if (userScrollsDown && entryIsLowerThanPrevious) {
          activate(entry);
          // if parent isn't scrolled, let's keep the first visible item, breaking the iteration
          if (!parentScrollTop) {
            return;
          }
          continue;
        }

        // if we are scrolling up, pick the smallest offsetTop
        if (!userScrollsDown && !entryIsLowerThanPrevious) {
          activate(entry);
        }
      }
    }
    _initializeTargetsAndObservables() {
      this._targetLinks = new Map();
      this._observableSections = new Map();
      const targetLinks = SelectorEngine.find(SELECTOR_TARGET_LINKS, this._config.target);
      for (const anchor of targetLinks) {
        // ensure that the anchor has an id and is not disabled
        if (!anchor.hash || isDisabled(anchor)) {
          continue;
        }
        const observableSection = SelectorEngine.findOne(anchor.hash, this._element);

        // ensure that the observableSection exists & is visible
        if (isVisible(observableSection)) {
          this._targetLinks.set(anchor.hash, anchor);
          this._observableSections.set(anchor.hash, observableSection);
        }
      }
    }
    _process(target) {
      if (this._activeTarget === target) {
        return;
      }
      this._clearActiveClass(this._config.target);
      this._activeTarget = target;
      target.classList.add(CLASS_NAME_ACTIVE$1);
      this._activateParents(target);
      EventHandler.trigger(this._element, EVENT_ACTIVATE, {
        relatedTarget: target
      });
    }
    _activateParents(target) {
      // Activate dropdown parents
      if (target.classList.contains(CLASS_NAME_DROPDOWN_ITEM)) {
        SelectorEngine.findOne(SELECTOR_DROPDOWN_TOGGLE$1, target.closest(SELECTOR_DROPDOWN)).classList.add(CLASS_NAME_ACTIVE$1);
        return;
      }
      for (const listGroup of SelectorEngine.parents(target, SELECTOR_NAV_LIST_GROUP)) {
        // Set triggered links parents as active
        // With both <ul> and <nav> markup a parent is the previous sibling of any nav ancestor
        for (const item of SelectorEngine.prev(listGroup, SELECTOR_LINK_ITEMS)) {
          item.classList.add(CLASS_NAME_ACTIVE$1);
        }
      }
    }
    _clearActiveClass(parent) {
      parent.classList.remove(CLASS_NAME_ACTIVE$1);
      const activeNodes = SelectorEngine.find(`${SELECTOR_TARGET_LINKS}.${CLASS_NAME_ACTIVE$1}`, parent);
      for (const node of activeNodes) {
        node.classList.remove(CLASS_NAME_ACTIVE$1);
      }
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = ScrollSpy.getOrCreateInstance(this, config);
        if (typeof config !== 'string') {
          return;
        }
        if (data[config] === undefined || config.startsWith('_') || config === 'constructor') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config]();
      });
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(window, EVENT_LOAD_DATA_API$1, () => {
    for (const spy of SelectorEngine.find(SELECTOR_DATA_SPY)) {
      ScrollSpy.getOrCreateInstance(spy);
    }
  });

  /**
   * jQuery
   */

  defineJQueryPlugin(ScrollSpy);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): tab.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME$1 = 'tab';
  const DATA_KEY$1 = 'bs.tab';
  const EVENT_KEY$1 = `.${DATA_KEY$1}`;
  const EVENT_HIDE$1 = `hide${EVENT_KEY$1}`;
  const EVENT_HIDDEN$1 = `hidden${EVENT_KEY$1}`;
  const EVENT_SHOW$1 = `show${EVENT_KEY$1}`;
  const EVENT_SHOWN$1 = `shown${EVENT_KEY$1}`;
  const EVENT_CLICK_DATA_API = `click${EVENT_KEY$1}`;
  const EVENT_KEYDOWN = `keydown${EVENT_KEY$1}`;
  const EVENT_LOAD_DATA_API = `load${EVENT_KEY$1}`;
  const ARROW_LEFT_KEY = 'ArrowLeft';
  const ARROW_RIGHT_KEY = 'ArrowRight';
  const ARROW_UP_KEY = 'ArrowUp';
  const ARROW_DOWN_KEY = 'ArrowDown';
  const CLASS_NAME_ACTIVE = 'active';
  const CLASS_NAME_FADE$1 = 'fade';
  const CLASS_NAME_SHOW$1 = 'show';
  const CLASS_DROPDOWN = 'dropdown';
  const SELECTOR_DROPDOWN_TOGGLE = '.dropdown-toggle';
  const SELECTOR_DROPDOWN_MENU = '.dropdown-menu';
  const NOT_SELECTOR_DROPDOWN_TOGGLE = ':not(.dropdown-toggle)';
  const SELECTOR_TAB_PANEL = '.list-group, .nav, [role="tablist"]';
  const SELECTOR_OUTER = '.nav-item, .list-group-item';
  const SELECTOR_INNER = `.nav-link${NOT_SELECTOR_DROPDOWN_TOGGLE}, .list-group-item${NOT_SELECTOR_DROPDOWN_TOGGLE}, [role="tab"]${NOT_SELECTOR_DROPDOWN_TOGGLE}`;
  const SELECTOR_DATA_TOGGLE = '[data-bs-toggle="tab"], [data-bs-toggle="pill"], [data-bs-toggle="list"]'; // todo:v6: could be only `tab`
  const SELECTOR_INNER_ELEM = `${SELECTOR_INNER}, ${SELECTOR_DATA_TOGGLE}`;
  const SELECTOR_DATA_TOGGLE_ACTIVE = `.${CLASS_NAME_ACTIVE}[data-bs-toggle="tab"], .${CLASS_NAME_ACTIVE}[data-bs-toggle="pill"], .${CLASS_NAME_ACTIVE}[data-bs-toggle="list"]`;

  /**
   * Class definition
   */

  class Tab extends BaseComponent {
    constructor(element) {
      super(element);
      this._parent = this._element.closest(SELECTOR_TAB_PANEL);
      if (!this._parent) {
        return;
        // todo: should Throw exception on v6
        // throw new TypeError(`${element.outerHTML} has not a valid parent ${SELECTOR_INNER_ELEM}`)
      }

      // Set up initial aria attributes
      this._setInitialAttributes(this._parent, this._getChildren());
      EventHandler.on(this._element, EVENT_KEYDOWN, event => this._keydown(event));
    }

    // Getters
    static get NAME() {
      return NAME$1;
    }

    // Public
    show() {
      // Shows this elem and deactivate the active sibling if exists
      const innerElem = this._element;
      if (this._elemIsActive(innerElem)) {
        return;
      }

      // Search for active tab on same parent to deactivate it
      const active = this._getActiveElem();
      const hideEvent = active ? EventHandler.trigger(active, EVENT_HIDE$1, {
        relatedTarget: innerElem
      }) : null;
      const showEvent = EventHandler.trigger(innerElem, EVENT_SHOW$1, {
        relatedTarget: active
      });
      if (showEvent.defaultPrevented || hideEvent && hideEvent.defaultPrevented) {
        return;
      }
      this._deactivate(active, innerElem);
      this._activate(innerElem, active);
    }

    // Private
    _activate(element, relatedElem) {
      if (!element) {
        return;
      }
      element.classList.add(CLASS_NAME_ACTIVE);
      this._activate(SelectorEngine.getElementFromSelector(element)); // Search and activate/show the proper section

      const complete = () => {
        if (element.getAttribute('role') !== 'tab') {
          element.classList.add(CLASS_NAME_SHOW$1);
          return;
        }
        element.removeAttribute('tabindex');
        element.setAttribute('aria-selected', true);
        this._toggleDropDown(element, true);
        EventHandler.trigger(element, EVENT_SHOWN$1, {
          relatedTarget: relatedElem
        });
      };
      this._queueCallback(complete, element, element.classList.contains(CLASS_NAME_FADE$1));
    }
    _deactivate(element, relatedElem) {
      if (!element) {
        return;
      }
      element.classList.remove(CLASS_NAME_ACTIVE);
      element.blur();
      this._deactivate(SelectorEngine.getElementFromSelector(element)); // Search and deactivate the shown section too

      const complete = () => {
        if (element.getAttribute('role') !== 'tab') {
          element.classList.remove(CLASS_NAME_SHOW$1);
          return;
        }
        element.setAttribute('aria-selected', false);
        element.setAttribute('tabindex', '-1');
        this._toggleDropDown(element, false);
        EventHandler.trigger(element, EVENT_HIDDEN$1, {
          relatedTarget: relatedElem
        });
      };
      this._queueCallback(complete, element, element.classList.contains(CLASS_NAME_FADE$1));
    }
    _keydown(event) {
      if (![ARROW_LEFT_KEY, ARROW_RIGHT_KEY, ARROW_UP_KEY, ARROW_DOWN_KEY].includes(event.key)) {
        return;
      }
      event.stopPropagation(); // stopPropagation/preventDefault both added to support up/down keys without scrolling the page
      event.preventDefault();
      const isNext = [ARROW_RIGHT_KEY, ARROW_DOWN_KEY].includes(event.key);
      const nextActiveElement = getNextActiveElement(this._getChildren().filter(element => !isDisabled(element)), event.target, isNext, true);
      if (nextActiveElement) {
        nextActiveElement.focus({
          preventScroll: true
        });
        Tab.getOrCreateInstance(nextActiveElement).show();
      }
    }
    _getChildren() {
      // collection of inner elements
      return SelectorEngine.find(SELECTOR_INNER_ELEM, this._parent);
    }
    _getActiveElem() {
      return this._getChildren().find(child => this._elemIsActive(child)) || null;
    }
    _setInitialAttributes(parent, children) {
      this._setAttributeIfNotExists(parent, 'role', 'tablist');
      for (const child of children) {
        this._setInitialAttributesOnChild(child);
      }
    }
    _setInitialAttributesOnChild(child) {
      child = this._getInnerElement(child);
      const isActive = this._elemIsActive(child);
      const outerElem = this._getOuterElement(child);
      child.setAttribute('aria-selected', isActive);
      if (outerElem !== child) {
        this._setAttributeIfNotExists(outerElem, 'role', 'presentation');
      }
      if (!isActive) {
        child.setAttribute('tabindex', '-1');
      }
      this._setAttributeIfNotExists(child, 'role', 'tab');

      // set attributes to the related panel too
      this._setInitialAttributesOnTargetPanel(child);
    }
    _setInitialAttributesOnTargetPanel(child) {
      const target = SelectorEngine.getElementFromSelector(child);
      if (!target) {
        return;
      }
      this._setAttributeIfNotExists(target, 'role', 'tabpanel');
      if (child.id) {
        this._setAttributeIfNotExists(target, 'aria-labelledby', `#${child.id}`);
      }
    }
    _toggleDropDown(element, open) {
      const outerElem = this._getOuterElement(element);
      if (!outerElem.classList.contains(CLASS_DROPDOWN)) {
        return;
      }
      const toggle = (selector, className) => {
        const element = SelectorEngine.findOne(selector, outerElem);
        if (element) {
          element.classList.toggle(className, open);
        }
      };
      toggle(SELECTOR_DROPDOWN_TOGGLE, CLASS_NAME_ACTIVE);
      toggle(SELECTOR_DROPDOWN_MENU, CLASS_NAME_SHOW$1);
      outerElem.setAttribute('aria-expanded', open);
    }
    _setAttributeIfNotExists(element, attribute, value) {
      if (!element.hasAttribute(attribute)) {
        element.setAttribute(attribute, value);
      }
    }
    _elemIsActive(elem) {
      return elem.classList.contains(CLASS_NAME_ACTIVE);
    }

    // Try to get the inner element (usually the .nav-link)
    _getInnerElement(elem) {
      return elem.matches(SELECTOR_INNER_ELEM) ? elem : SelectorEngine.findOne(SELECTOR_INNER_ELEM, elem);
    }

    // Try to get the outer element (usually the .nav-item)
    _getOuterElement(elem) {
      return elem.closest(SELECTOR_OUTER) || elem;
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Tab.getOrCreateInstance(this);
        if (typeof config !== 'string') {
          return;
        }
        if (data[config] === undefined || config.startsWith('_') || config === 'constructor') {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config]();
      });
    }
  }

  /**
   * Data API implementation
   */

  EventHandler.on(document, EVENT_CLICK_DATA_API, SELECTOR_DATA_TOGGLE, function (event) {
    if (['A', 'AREA'].includes(this.tagName)) {
      event.preventDefault();
    }
    if (isDisabled(this)) {
      return;
    }
    Tab.getOrCreateInstance(this).show();
  });

  /**
   * Initialize on focus
   */
  EventHandler.on(window, EVENT_LOAD_DATA_API, () => {
    for (const element of SelectorEngine.find(SELECTOR_DATA_TOGGLE_ACTIVE)) {
      Tab.getOrCreateInstance(element);
    }
  });
  /**
   * jQuery
   */

  defineJQueryPlugin(Tab);

  /**
   * --------------------------------------------------------------------------
   * Bootstrap (v5.3.0-alpha1): toast.js
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
   * --------------------------------------------------------------------------
   */

  /**
   * Constants
   */

  const NAME = 'toast';
  const DATA_KEY = 'bs.toast';
  const EVENT_KEY = `.${DATA_KEY}`;
  const EVENT_MOUSEOVER = `mouseover${EVENT_KEY}`;
  const EVENT_MOUSEOUT = `mouseout${EVENT_KEY}`;
  const EVENT_FOCUSIN = `focusin${EVENT_KEY}`;
  const EVENT_FOCUSOUT = `focusout${EVENT_KEY}`;
  const EVENT_HIDE = `hide${EVENT_KEY}`;
  const EVENT_HIDDEN = `hidden${EVENT_KEY}`;
  const EVENT_SHOW = `show${EVENT_KEY}`;
  const EVENT_SHOWN = `shown${EVENT_KEY}`;
  const CLASS_NAME_FADE = 'fade';
  const CLASS_NAME_HIDE = 'hide'; // @deprecated - kept here only for backwards compatibility
  const CLASS_NAME_SHOW = 'show';
  const CLASS_NAME_SHOWING = 'showing';
  const DefaultType = {
    animation: 'boolean',
    autohide: 'boolean',
    delay: 'number'
  };
  const Default = {
    animation: true,
    autohide: true,
    delay: 5000
  };

  /**
   * Class definition
   */

  class Toast extends BaseComponent {
    constructor(element, config) {
      super(element, config);
      this._timeout = null;
      this._hasMouseInteraction = false;
      this._hasKeyboardInteraction = false;
      this._setListeners();
    }

    // Getters
    static get Default() {
      return Default;
    }
    static get DefaultType() {
      return DefaultType;
    }
    static get NAME() {
      return NAME;
    }

    // Public
    show() {
      const showEvent = EventHandler.trigger(this._element, EVENT_SHOW);
      if (showEvent.defaultPrevented) {
        return;
      }
      this._clearTimeout();
      if (this._config.animation) {
        this._element.classList.add(CLASS_NAME_FADE);
      }
      const complete = () => {
        this._element.classList.remove(CLASS_NAME_SHOWING);
        EventHandler.trigger(this._element, EVENT_SHOWN);
        this._maybeScheduleHide();
      };
      this._element.classList.remove(CLASS_NAME_HIDE); // @deprecated
      reflow(this._element);
      this._element.classList.add(CLASS_NAME_SHOW, CLASS_NAME_SHOWING);
      this._queueCallback(complete, this._element, this._config.animation);
    }
    hide() {
      if (!this.isShown()) {
        return;
      }
      const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE);
      if (hideEvent.defaultPrevented) {
        return;
      }
      const complete = () => {
        this._element.classList.add(CLASS_NAME_HIDE); // @deprecated
        this._element.classList.remove(CLASS_NAME_SHOWING, CLASS_NAME_SHOW);
        EventHandler.trigger(this._element, EVENT_HIDDEN);
      };
      this._element.classList.add(CLASS_NAME_SHOWING);
      this._queueCallback(complete, this._element, this._config.animation);
    }
    dispose() {
      this._clearTimeout();
      if (this.isShown()) {
        this._element.classList.remove(CLASS_NAME_SHOW);
      }
      super.dispose();
    }
    isShown() {
      return this._element.classList.contains(CLASS_NAME_SHOW);
    }

    // Private

    _maybeScheduleHide() {
      if (!this._config.autohide) {
        return;
      }
      if (this._hasMouseInteraction || this._hasKeyboardInteraction) {
        return;
      }
      this._timeout = setTimeout(() => {
        this.hide();
      }, this._config.delay);
    }
    _onInteraction(event, isInteracting) {
      switch (event.type) {
        case 'mouseover':
        case 'mouseout':
          {
            this._hasMouseInteraction = isInteracting;
            break;
          }
        case 'focusin':
        case 'focusout':
          {
            this._hasKeyboardInteraction = isInteracting;
            break;
          }
      }
      if (isInteracting) {
        this._clearTimeout();
        return;
      }
      const nextElement = event.relatedTarget;
      if (this._element === nextElement || this._element.contains(nextElement)) {
        return;
      }
      this._maybeScheduleHide();
    }
    _setListeners() {
      EventHandler.on(this._element, EVENT_MOUSEOVER, event => this._onInteraction(event, true));
      EventHandler.on(this._element, EVENT_MOUSEOUT, event => this._onInteraction(event, false));
      EventHandler.on(this._element, EVENT_FOCUSIN, event => this._onInteraction(event, true));
      EventHandler.on(this._element, EVENT_FOCUSOUT, event => this._onInteraction(event, false));
    }
    _clearTimeout() {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    // Static
    static jQueryInterface(config) {
      return this.each(function () {
        const data = Toast.getOrCreateInstance(this, config);
        if (typeof config === 'string') {
          if (typeof data[config] === 'undefined') {
            throw new TypeError(`No method named "${config}"`);
          }
          data[config](this);
        }
      });
    }
  }

  /**
   * Data API implementation
   */

  enableDismissTrigger(Toast);

  /**
   * jQuery
   */

  defineJQueryPlugin(Toast);

  function zeroPad(num, len = 3) {
      return ("0".repeat(len) + String(num)).slice(len * -1);
  }

  function secondsToTimestamp(s, options = {}) {
      options = {...{hours: true, milliseconds: false}, ...options};

      const date = new Date(parseInt(s) * 1000).toISOString();

      if (date.slice(11, 13) !== '00') {
          options.hours = true;
      }
      const hms = date.slice(options.hours ? 11 : 14, 19);

      if (options.milliseconds) {
          let fraction = '000';
          if (s.toString().indexOf('.') > -1) {
              fraction = (String(s).split('.').pop() + '000').slice(0, 3);
          }
          return hms + '.' + fraction;
      }
      return hms;
  }

  function timestampToSeconds(timestamp, fixedString = false) {
      let [seconds, minutes, hours] = timestamp.split(':').reverse();
      let milliseconds = 0;
      if (seconds.indexOf('.') > -1) {
          [seconds, milliseconds] = seconds.split('.');
      }

      hours = parseInt(hours || 0);
      minutes = parseInt(minutes || 0);
      seconds = parseInt(seconds || 0);
      milliseconds = parseInt(milliseconds) / 1000;


      if (seconds > 59) {
          let extraMinutes = Math.floor(seconds / 60);
          minutes += extraMinutes;
          seconds -= extraMinutes * 60;
      }

      if (minutes > 59) {
          let extraHours = Math.floor(minutes / 60);
          hours += extraHours;
          minutes -= extraHours * 60;
      }

      if (fixedString) {
          return parseFloat((hours * 3600 + minutes * 60 + seconds + milliseconds).toFixed(3));
      }
      return hours * 3600 + minutes * 60 + seconds + milliseconds;
  }

  function hash$3() {
      return (Math.random() + 1).toString(16).substring(7);
  }

  function escapeRegExpCharacters(text) {
      return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  function enforceMilliseconds(seconds) {
      return parseFloat(seconds.toFixed(3));
  }

  function formatBytes(bytes, decimals = 2, format = 'KB') {
      if (bytes < 1) {
          return '0 B';
      }
      const k = format === 'kB' ? 1000 : 1024;
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      const sizes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
      const suffix = [format === 'kB' ? sizes[i].toLowerCase() : sizes[i], 'B'];
      if (format === 'KiB') {
          suffix.splice(1, 0, 'i');
      }
      return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + suffix.join('');
  }

  class Timeline {

      isInitRun = true;
      hoverPosition = 0;
      clickPosition = 0;
      dragNode = false;
      dragNodeCoords = {};
      dragHandle = null;
      timecodeNode = null;
      currentBlobURL = null;
      color = null;

      constructor(duration, chapters = [], node, options = {}) {

          this.color = getComputedStyle(document.documentElement).getPropertyValue('--ct-fg-full');

          this.node = node;
          this.id = ((Math.random() * 10e16).toString(16)).split('.').shift();

          this.dragHandle = this.node.querySelector('.drag-handle');
          this.timecodeNode = this.node.querySelector('.timecode');


          this.options = {
              ...{
                  backgroundWidth: 2560,
                  backgroundHeight: 2560 * 0.05,
                  secondSnap: 1
              }, ...options
          };

          this.node.querySelector('.backdrop .ratio').style.setProperty(
              '--bs-aspect-ratio',
              (this.options.backgroundHeight / this.options.backgroundWidth * 100) + '%'
          );

          this.setDuration(duration);
          this.setChapters(chapters);
          this.render();
          this.isInitRun = false;

          this.node.addEventListener('mousemove', this.mouseMoveHandler.bind(this));

          this.node.addEventListener('mouseout', () => {
              this.node.style.setProperty('--hover-display', 'none');
          });

          this.node.addEventListener('click', e => {
              e.preventDefault();

              const link = e.target.closest('a');
              if (link) {
                  if (link.matches('.insert')) {
                      window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: this.clickPosition}}));
                  }
                  this.node.classList.remove('clicked');
                  return;
              }

              const chapter = e.target.closest('.chapter');
              if (chapter) {
                  const payload = {detail: {index: parseInt(chapter.dataset.index)}};
                  window.dispatchEvent(new CustomEvent('timeline:scrollintoview', payload));
              }

              if (e.target.matches('.backdrop, .chapters')) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const progress = (x / rect.width);
                  this.clickPosition = this.duration * progress;

                  this.updateMarker(x, progress);
              }

          });

          this.node.querySelector('.chapters').addEventListener('mousedown', e => {
              if (e.target.matches('.bar')) {
                  e.preventDefault();
                  this.dragNode = e.target.closest('.chapter');

                  const nodeBounds = this.node.getBoundingClientRect();
                  const dragNodeBounds = this.dragNode.getBoundingClientRect();
                  this.dragNodeCoords = {
                      left: dragNodeBounds.left - nodeBounds.left,
                      right: dragNodeBounds.right - nodeBounds.left
                  };

                  this.mouseMoveHandler(e);

                  this.dragNode.classList.add('is-dragged');
                  this.node.classList.add('dragging');
              }
          });


          document.body.addEventListener('mouseup', () => {
              this.node.classList.remove('dragging');
              if (this.dragNode) {
                  this.dragNode.classList.remove('is-dragged');
                  window.dispatchEvent(new CustomEvent('timeline:move', {
                      detail: {
                          index: this.dragNode.dataset.index,
                          startTime: this.hoverPosition
                      }
                  }));
              }
              this.dragNode = false;
          });


      }

      setDuration(duration) {
          if (typeof duration !== 'number') {
              duration = timestampToSeconds(duration);
          }

          this.duration = duration;
          if (!this.isInitRun) {
              this.render();
          }
      }


      render() {
          this.createBackground();
          this.renderChapters();
      }

      createBackground() {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          canvas.setAttribute('width', this.options.backgroundWidth);
          canvas.setAttribute('height', this.options.backgroundHeight);

          context.fillStyle = this.color;
          context.strokeStyle = this.color;


          const draw = (context, x, h, label) => {
              let y = (1 - (h * 0.75)) * this.options.backgroundHeight;
              x = x * this.options.backgroundWidth;

              context.moveTo(x, y);
              context.lineTo(x, this.options.backgroundHeight);

              if (label) {
                  context.font = (this.options.backgroundHeight * 0.3 * (label.scale || 1)) + 'px sans-serif';
                  context.fillText(label.text, x, y);
              }

          };

          context.textAlign = 'center';
          context.textBaseline = 'bottom';
          context.beginPath();
          for (let s = 0; s <= this.duration; s += 5) {
              if (s % 3600 === 0) {
                  draw(context, s / this.duration, 0.8, s === 0 ? null : {
                      text: secondsToTimestamp(s).slice(0, 8)
                  });
                  continue;
              }

              if (s % 600 === 0 && this.duration <= 7200) {
                  draw(context, s / this.duration, 0.5, {
                      text: secondsToTimestamp(s).slice(0, 8),
                      scale: 0.7
                  });
                  continue;
              }

              if (s % 900 === 0 && this.duration > 7200 && this.duration <= 14400) {
                  draw(context, s / this.duration, 0.5, {
                      text: secondsToTimestamp(s).slice(0, 8),
                      scale: 0.7
                  });
                  continue;
              }

              if (s % 1800 === 0 && this.duration > 7200) {
                  draw(context, s / this.duration, 0.5, {
                      text: secondsToTimestamp(s).slice(0, 8),
                      scale: 0.7
                  });
                  continue;
              }

              if (s % 60 === 0 && this.duration <= 7200) {
                  draw(context, s / this.duration, 0.25);
              }

              if (s % 300 === 0 && this.duration > 7200) {
                  draw(context, s / this.duration, 0.25);
              }

          }
          context.stroke();
          context.closePath();

          canvas.toBlob(blob => {

              const url = URL.createObjectURL(blob);

              this.node.querySelector('.backdrop .ratio').style.setProperty(
                  'background-image',
                  `url(${url})`
              );

              if (this.currentBlobURL) {
                  URL.revokeObjectURL(this.currentBlobURL);
              }
              this.currentBlobURL = url;

          });
      }

      setChapters(chapters) {

          this.chapters = chapters;

          if (!this.isInitRun) {
              this.render();
          }
      }

      renderChapters() {
          this.node.querySelectorAll('.chapter').forEach(node => node.remove());

          const parentNodes = this.node.querySelector('.chapters');
          this.chapters.forEach((chapter, i) => {
              const nextStart = this.chapters[i + 1] ? this.chapters[i + 1].startTime : this.duration;
              const width = ((((nextStart - chapter.startTime) / this.duration) * 100)) + '%';
              const node = document.createElement('div');
              const left = (chapter.startTime / this.duration) * 100;
              node.setAttribute('href', `#chapter_${i}`);
              node.classList.add('chapter', 'cursor-pointer');
              node.dataset.index = i;
              node.style.setProperty('left', left + '%');
              node.style.setProperty('width', width);


              const bar = document.createElement('div');
              bar.classList.add('bar');
              node.appendChild(bar);


              parentNodes.appendChild(node);


          });
      }

      setActive(index) {
          const active = this.node.querySelector('.chapter.active');
          if (active) {
              active.classList.remove('active');
          }

          if (index === false) {
              return;
          }
          this.node.querySelectorAll('.chapter')[index].classList.add('active');
      }

      mouseMoveHandler(e) {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const progress = (x / rect.width);
          this.hoverPosition = this.duration * progress;


          this.node.style.setProperty('--x', x + 'px');
          this.node.style.setProperty('--progress', progress);
          this.node.style.setProperty('--y', y + 'px');
          this.node.style.setProperty('--hover-display', 'block');
          this.timecodeNode.dataset.text = secondsToTimestamp(this.hoverPosition).slice(0, 8);

          if (this.dragNode) {
              this.dragHandle.style.setProperty('left', x + 'px');

              let left = 0;
              let width = (this.dragNodeCoords.right - this.dragNodeCoords.left) - (x - this.dragNodeCoords.left);
              if (x >= this.dragNodeCoords.right) {
                  left = width;
                  width = width * -1;
              }

              this.dragHandle.style.setProperty('--width', width + 'px');
              this.dragHandle.style.setProperty('--left', left + 'px');
          }


      }

      setMarkerAt(timestamp) {
          const progress = timestamp / this.duration;
          const x = this.node.getBoundingClientRect().width * progress;
          this.clickPosition = timestamp;
          this.updateMarker(x, progress);
      }

      updateMarker(x, progress) {
          this.node.style.setProperty('--click-x', x + 'px');
          this.node.style.setProperty('--click-progress', progress);
          const insert = this.node.querySelector('.marker a.insert');
          const string = 'insert chapter at ' + secondsToTimestamp(this.clickPosition).slice(0, 8);
          insert.setAttribute('title', string);
          insert.dataset.bsOriginalTitle = string;
          this.node.classList.add('clicked');

          window.dispatchEvent(new CustomEvent('timeline:marker-set', {detail: {time: this.clickPosition}}));

      }

  }

  function escapeStringRegexp(string) {
  	if (typeof string !== 'string') {
  		throw new TypeError('Expected a string');
  	}

  	// Escape characters with special meaning either inside or outside character sets.
  	// Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  	return string
  		.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
  		.replace(/-/g, '\\x2d');
  }

  function trimRepeated(string, target) {
  	if (typeof string !== 'string' || typeof target !== 'string') {
  		throw new TypeError('Expected a string');
  	}

  	const regex = new RegExp(`(?:${escapeStringRegexp(target)}){2,}`, 'g');

  	return string.replace(regex, target);
  }

  /* eslint-disable no-control-regex */

  function filenameReservedRegex() {
  	return /[<>:"/\\|?*\u0000-\u001F]/g;
  }

  function windowsReservedNameRegex() {
  	return /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  }

  function stripOuter(string, substring) {
  	if (typeof string !== 'string' || typeof substring !== 'string') {
  		throw new TypeError('Expected a string');
  	}

  	if (string.startsWith(substring)) {
  		string = string.slice(substring.length);
  	}

  	if (string.endsWith(substring)) {
  		string = string.slice(0, -substring.length);
  	}

  	return string;
  }

  // Doesn't make sense to have longer filenames
  const MAX_FILENAME_LENGTH = 100;

  const reControlChars = /[\u0000-\u001F\u0080-\u009F]/g; // eslint-disable-line no-control-regex
  const reRelativePath = /^\.+(\\|\/)|^\.+$/;
  const reTrailingPeriods = /\.+$/;

  function filenamify(string, options = {}) {
  	if (typeof string !== 'string') {
  		throw new TypeError('Expected a string');
  	}

  	const replacement = options.replacement === undefined ? '!' : options.replacement;

  	if (filenameReservedRegex().test(replacement) && reControlChars.test(replacement)) {
  		throw new Error('Replacement string cannot contain reserved filename characters');
  	}

  	string = string.normalize('NFD');
  	string = string.replace(reRelativePath, replacement);
  	string = string.replace(filenameReservedRegex(), replacement);
  	string = string.replace(reControlChars, replacement);
  	string = string.replace(reTrailingPeriods, '');

  	if (replacement.length > 0) {
  		const startedWithDot = string[0] === '.';

  		string = trimRepeated(string, replacement);
  		string = string.length > 1 ? stripOuter(string, replacement) : string;

  		// We removed the whole filename
  		if (!startedWithDot && string[0] === '.') {
  			string = replacement + string;
  		}

  		// We removed the whole extension
  		if (string[string.length - 1] === '.') {
  			string += replacement;
  		}
  	}

  	string = windowsReservedNameRegex().test(string) ? string + replacement : string;
  	const allowedLength = typeof options.maxLength === 'number' ? options.maxLength : MAX_FILENAME_LENGTH;
  	if (string.length > allowedLength) {
  		const extensionIndex = string.lastIndexOf('.');
  		if (extensionIndex === -1) {
  			string = string.slice(0, allowedLength);
  		} else {
  			const filename = string.slice(0, extensionIndex);
  			const extension = string.slice(extensionIndex);
  			string = filename.slice(0, Math.max(1, allowedLength - extension.length)) + extension;
  		}
  	}

  	return string;
  }

  class FormatBase {

      supportsPrettyPrint = false;
      chapterTitleTemplate = 'Chapter $chapter of $total';
      chapters = [];
      defaultMeta = {
          author: '',
          title: '',
          podcastName: '',
          description: '',
          fileName: '',
          waypoints: false,
          version: '1.0.0'
      };

      filename = 'chapters.json';
      mimeType = 'application/json';

      duration = 0;

      isChapterFormat = true;

      constructor(input = null, extraProperties = {}) {
          Object.entries(extraProperties).forEach(([key, value]) => this[key] = value);

          this.meta = {...this.defaultMeta};

          if (!input) ; else if (typeof input === 'string') {
              this.parse(input);
          } else if ('isChapterFormat' in input) {
              this.chapters = JSON.parse(JSON.stringify(input.chapters));
              this.meta = {...this.meta, ...JSON.parse(JSON.stringify(input.meta))};
          }


          if (this.chapters.length > 0) {
              let chapter = this.chapters.at(-1);
              if (chapter.endTime) {
                  this.duration = chapter.endTime;
              } else if (chapter.startTime) {
                  this.duration = chapter.startTime;
              }
          }
          if (this.duration === 0) {
              this.duration = 3600;
          }


          this.bump();
      }

      detect(inputString) {
          try {
              const data = JSON.parse(inputString);
              const {errors} = this.test(data);
              if (errors.length > 0) {
                  throw new Error('data test failed');
              }
          } catch (e) {
              return false;
          }
          return true;
      }

      test(data) {
          if (!('chapters' in data)) {
              return {errors: ['JSON Structure: missing "chapters"']};
          }
          if (!('version' in data)) {
              return {errors: ['JSON Structure: missing "version"']};
          }
          return {errors: []};
      }

      bump(keepDuration = false) {
          this.chapters.sort((a, b) => a.startTime - b.startTime);
          const lastChapter = this.chapters.at(-1);

          if (lastChapter && !keepDuration) {
              this.duration = Math.max(parseFloat(this.duration || 0), parseFloat(lastChapter.endTime || 0), parseFloat(lastChapter.startTime || 0));
          }

          this.chapters = this.chapters.map((chapter, index) => {
              const endTime = this.endTime(index);
              const duration = endTime - this.chapters[index].startTime;
              const timestampOptions = {hours: false};
              return {
                  ...{
                      id: hash$3(),
                      startTime: 0
                  },
                  ...chapter,
                  ...{
                      endTime,
                      duration,
                      startTime_hr: secondsToTimestamp(chapter.startTime, timestampOptions),
                      endTime_hr: secondsToTimestamp(endTime, timestampOptions),
                      duration_hr: secondsToTimestamp(duration, timestampOptions)
                  }, ...('toc' in chapter ? {} : {toc: true})
              }
          });
      }

      endTime(index) {
          /*
          if (!recalculateEndTime && 'endTime' in this.chapters[index]) {
              return this.chapters[index].endTime;
          }
           */
          return this.chapters[index + 1] ? (this.chapters[index + 1].startTime - 0.001) : this.duration;
      }

      expandFirstToStart() {
          this.chapters[0].startTime = 0;
          this.bump();
      }

      add(chapter) {
          this.chapters.push(chapter);
          this.bump();
      }

      remove(index) {
          if (this.chapters[index] && this.chapters[index].img && this.chapters[index].img.slice(0, 5) === 'blob:') {
              URL.revokeObjectURL(this.chapters[index].img);
          }
          this.chapters.splice(index, 1);
          this.bump();
      }

      to(className) {

          return new className(this);
      }

      parse(string) {
          const data = JSON.parse(string);
          const {errors} = this.test(data);
          if (errors.length > 0) {
              throw new Error(errors.join(''));
          }


          this.chapters = data.chapters;

          this.chapters = this.chapters.map(chapter => {
              if ('img' in chapter) {
                  if (chapter.img.slice(0, 4) === 'http') {
                      chapter.img_type = 'absolute';
                  } else {
                      chapter.img_type = 'relative';
                      chapter.img_filename = chapter.img;
                  }
              }
              return chapter;
          });

          this.meta = Object.fromEntries(Object.entries(this.meta).map(([key, value]) => [key, data[key] || value]));
      }

      toString(pretty = false, exportOptions = {}) {
          const options = {
              ...
                  {
                      imagePrefix: '',
                      writeRedundantToc: false,
                      writeEndTimes: false
                  }, ...exportOptions
          };
          const defaultMetaProperties = Object.keys(this.defaultMeta);
          return JSON.stringify(
              {
                  ...Object.fromEntries(
                      Object.entries(this.meta).filter(([key, value]) => {
                          return defaultMetaProperties.includes(key) && value !== '' && value !== false;
                      })
                  ),
                  ...{
                      chapters: this.chapters.map(chapter => {
                          let filtered = {
                              startTime: enforceMilliseconds(chapter.startTime)
                          };

                          if (options.writeEndTimes) {
                              filtered.endTime = enforceMilliseconds(chapter.endTime);
                          }

                          if ('toc' in chapter && chapter.toc === false) {
                              filtered.toc = false;
                          }
                          if (!('toc' in filtered) && options.writeRedundantToc) {
                              filtered.toc = true;
                          }

                          ['location', 'img', 'url', 'title'].forEach(property => {
                              if (property in chapter && chapter[property].trim().length > 0) {
                                  filtered[property] = chapter[property];
                              }
                          });

                          if ('img_filename' in chapter && 'img' in filtered) {
                              filtered.img = filenamify(chapter.img_filename);
                          }

                          if (options.imagePrefix.trim().length > 0 && 'img' in filtered && ['relative', 'blob'].includes(chapter.img_type)) {
                              filtered.img = options.imagePrefix + filtered.img;
                          }


                          return filtered;
                      })
                  }
              }
              , null, pretty ? 2 : null);
      }

      stringToLines(string) {
          return string.split(/\r?\n/)
              .filter(line => line.trim().length > 0)
              .map(line => line.trim());
      }

      applyChapterMinLength(seconds) {
          const originalIdMap = this.chapters.map(chapter => chapter.id);
          const newChapters = [];
          let elapsed = 0;
          let currentChapter;

          this.chapters.forEach(chapter => {
              elapsed += chapter.duration;
              if (!currentChapter) {
                  currentChapter = chapter;
              }
              if (elapsed >= seconds) {
                  delete currentChapter.endTime;
                  delete currentChapter.duration;
                  newChapters.push(currentChapter);
                  currentChapter = 0;
                  elapsed = 0;
              }
          });

          this.chapters = newChapters;
          this.bump();

          const newIdMap = Object.fromEntries(this.chapters.map((c, i) => [c.id, i]));
          return Object.fromEntries(originalIdMap.map((id, index) => {
              return [index, id in newIdMap ? newIdMap[id] : 'deleted']
          }));
      }

      addChapterAt(index) {

          let startTime = 0;
          if (index > this.chapters.length) {
              let start = this.chapters.at(-1) ? this.chapters.at(-1).startTime : 0;
              startTime = start + (this.duration - start) * .5;
          } else if (index === 0) {
              startTime = 0;
          } else {
              let start = this.chapters.at(index - 1).startTime;
              let end = this.chapters.at(index) ? this.chapters.at(index).startTime : this.duration;
              startTime = start + (end - start) * .5;
          }

          this.chapters.push({
              id: hash$3(),
              startTime
          });

          this.bump();
          return startTime;
      }

      addChapterAtTime(startTime, inputChapter = {}) {
          if (this.chapterExistsAtStartTime(startTime)) {
              return false;
          }

          this.chapters.push({
              ...{
                  id: hash$3(),
                  startTime
              }, ...inputChapter
          });
          this.bump();

          return true;
      }

      rebuildChapterTitles(template = null) {
          this.chapters.forEach((chapter, index) => {
              this.chapters[index].title = this.getChapterTitle(index, template);
          });
      }

      getChapterTitle(index, template = null) {
          template = template || this.chapterTitleTemplate;
          return template.replace('$chapter', index + 1).replace('$total', this.chapters.length)
      }

      chapterExistsAtStartTime(time) {
          return this.chapters.filter(c => c.startTime === time).length > 0;
      }


      updateChapterStartTime(index, startTime) {
          const newStartTime = timestampToSeconds(startTime);
          if (this.chapterExistsAtStartTime(newStartTime)) {
              return 'timeInUse';
          }

          if (newStartTime > this.duration) {
              this.duration = newStartTime;
          }

          this.chapters[index].startTime = newStartTime;
          this.bump();
          return newStartTime;
      }

      chapterIndexFromStartTime(startTime) {
          return this.chapters.reduce((newIndex, chapter, index) => {
              if (chapter.startTime === startTime) {
                  newIndex = index;
              }
              return newIndex;
          }, 0);
      }

      chapterIndexFromTime(time) {
          return this.chapters.reduce((newIndex, chapter, index) => {
              if (time > chapter.startTime) {
                  newIndex = index;
              }
              return newIndex;
          }, false);
      }

      ensureUniqueFilenames(){
          const usedFilenames = [];
          this.chapters = this.chapters.map(chapter => {
              if (chapter.img_type !== 'blob') {
                  return chapter;
              }

              chapter.img_filename = filenamify(chapter.img_filename);

              let filename = chapter.img_filename;
              if(usedFilenames.includes(filename)){
                  filename = filename.replace(/(\.\w+)$/,`_${hash$3()}$1`);
                  chapter.img_filename = filename;
              }
              usedFilenames.push(filename);

              return chapter;
          });

      }

      applyImgUri(imgUri){
          this.chapters.forEach((chapter, i) => {
              if('img' in chapter){
                  this.chapters[i].img = imgUri.replace(/\/*$/,'')  + '/' + chapter.img.replace(/^\/*/,'');
              }
          });
      }
  }

  class ChaptersJson extends FormatBase {
      supportsPrettyPrint = true;
  }

  class FFMetadata extends FormatBase {

      filename = 'FFMpegdata.txt';
      mimeType = 'text/plain';

      constructor(input) {
          const characters = ["=", ";", "#", "\\", "\n"];
          const safeCharacters = characters.map(char => escapeRegExpCharacters(char)).join('|');
          super(input, {
              unescapeRegexp: new RegExp('\\\\(' + safeCharacters + ')', 'g'),
              escapeRegexp: new RegExp('(' + safeCharacters + ')', 'g')
          });
      }

      detect(inputString) {
          return inputString.trim().slice(0, 12) === ';FFMETADATA1';
      }

      parse(string) {
          if (!this.detect(string)) {
              throw new Error(';FFMETADATA1 header missing :(');
          }
          const lines = this.stringToLines(string);


          let chapters = [];
          let ignoreAllUntilNextChapter = false;
          let isMultilineTitle = false;

          lines.forEach(line => {
              let [key, value] = line.split('=');
              if (chapters.length === 0 && key === 'title') {
                  this.meta.title = this.unescape(value);
                  return;
              }


              if (line === '[CHAPTER]') {
                  chapters.push({});
                  ignoreAllUntilNextChapter = false;
                  return;
              }
              if (line.slice(0, 1) === '[') {
                  ignoreAllUntilNextChapter = true;
              }
              if (chapters.length === 0 || ignoreAllUntilNextChapter) {
                  return;
              }

              if (!/[^\\]=/.test(line) && isMultilineTitle) {
                  //should I keep the multilines?!
                  chapters[chapters.length - 1].title += ' ' + line;
                  return;
              }
              isMultilineTitle = false;

              if (key === 'title') {
                  chapters[chapters.length - 1].title = this.unescape(value);
                  if (/\\$/.test(value)) {
                      isMultilineTitle = true;
                  }
              } else if (key === 'START') {
                  chapters[chapters.length - 1].startTime = enforceMilliseconds(parseFloat(value) * 1e-3);
              } else if (key === 'END') {
                  chapters[chapters.length - 1].endTime = enforceMilliseconds(parseFloat(value) * 1e-3);
              }
          });

          this.chapters = chapters;
      }

      unescape(string) {
          return string.replace(this.unescapeRegexp, '$1').replace(/\\$/g, '');
      }

      escape(string) {
          return string.replace(this.escapeRegexp, '\\$1')
      }

      toString() {
          let output = [';FFMETADATA1'];
          if (this.meta.title.trim().length > 0) {
              output.push(`title=${this.escape(this.meta.title)}`);
          }
          output.push('');
          this.chapters.forEach(chapter => {
              output.push('[CHAPTER]', 'TIMEBASE=1/1000');
              output.push('START=' + (enforceMilliseconds(chapter.startTime) * 1000));
              output.push('END=' + (enforceMilliseconds(chapter.endTime) * 1000));
              if (chapter.title?.trim().length > 0) {
                  output.push(`title=${this.escape(chapter.title)}`);
              }
              output.push('');
          });

          return output.join("\n");
      }
  }

  class MatroskaXML extends FormatBase {

      supportsPrettyPrint = true;
      filename = 'matroska-chapters.xml';
      mimeType = 'text/xml';

      constructor(input, extraProperties = null) {
          super(input, extraProperties || {
              chapterStringNodeName: 'ChapString',
              inputTimeToSeconds: string => parseFloat(string) / 1e9,
              secondsToOutputTime: seconds => parseInt(seconds * 1e9)
          });
      }

      detect(inputString) {
          return /^<\?xml/.test(inputString.trim()) && /<Chapters>/.test(inputString) && inputString.indexOf(`<${this.chapterStringNodeName}>`) > -1;
      }

      parse(string) {
          if (!this.detect(string)) {
              throw new Error('Input needs xml declaration and a <Chapters> node');
          }

          let dom;
          if (typeof DOMParser !== 'undefined') {
              dom = (new DOMParser()).parseFromString(string, 'application/xml');
          } else {
              const {JSDOM} = jsdom;
              dom = new JSDOM(string, {contentType: 'application/xml'});
              dom = dom.window.document;
          }

          this.chapters = [...dom.querySelectorAll('ChapterAtom')].map(chapter => {
              return {
                  title: chapter.querySelector(this.chapterStringNodeName).textContent,
                  startTime: this.inputTimeToSeconds(chapter.querySelector('ChapterTimeStart').textContent),
                  endTime: this.inputTimeToSeconds(chapter.querySelector('ChapterTimeEnd').textContent),
              };
          });

      }

      toString(pretty = false) {
          const indent = (depth, string, spacesPerDepth = 2) => (pretty ? ' '.repeat(depth * spacesPerDepth) : '') + string;

          let output = [
              '<?xml version="1.0" encoding="UTF-8"?>',
              '<!DOCTYPE Chapters SYSTEM "matroskachapters.dtd">',
              '<Chapters>',
              indent(1, '<EditionEntry>'),
              indent(2, `<EditionUID>${Date.now()}${parseInt(Math.random() * 1e6)}</EditionUID>`)
          ];

          this.chapters.forEach((chapter, index) => {

              output.push(indent(2, '<ChapterAtom>'));
              output.push(indent(3, `<ChapterTimeStart>${this.secondsToOutputTime(chapter.startTime)}</ChapterTimeStart>`));
              output.push(indent(3, `<ChapterTimeEnd>${this.secondsToOutputTime(chapter.endTime)}</ChapterTimeEnd>`));
              output.push(indent(3, `<ChapterUID>${parseInt(1 + chapter.startTime)}${parseInt(Math.random() * 1e6)}</ChapterUID>`));
              output.push(indent(3, '<ChapterDisplay>'));
              output.push(indent(4, `<${this.chapterStringNodeName}>${chapter.title || this.getChapterTitle(index)}</${this.chapterStringNodeName}>`));
              output.push(indent(3, '</ChapterDisplay>'));
              output.push(indent(2, '</ChapterAtom>'));
          });

          output.push(
              indent(1, '</EditionEntry>'),
              '</Chapters>'
          );

          return output.join(pretty ? "\n" : '');
      }
  }

  class MKVMergeXML extends MatroskaXML {

      supportsPrettyPrint = true;
      filename = 'mkvmerge-chapters.xml';
      mimeType = 'text/xml';

      constructor(input) {
          super(input, {
              chapterStringNodeName: 'ChapterString',
              inputTimeToSeconds: string => timestampToSeconds(string),
              secondsToOutputTime: seconds => secondsToTimestamp(seconds, {hours :true, milliseconds : true})
          });
      }
  }

  class MKVMergeSimple extends FormatBase {

      filename = 'mkvmerge-chapters.txt';
      mimeType = 'text/plain';

      detect(inputString) {
          return /^CHAPTER01/.test(inputString.trim());
      }

      parse(string) {
          if(!this.detect(string)){
              throw new Error('File must start with CHAPTER01')
          }

          const lines = string.split(/\r?\n/)
              .filter(line => line.trim().length > 0)
              .map(line => line.trim());

          let chapters = [];
          lines.forEach(line => {
              const match = /^CHAPTER(?<index>\d+)(?<key>NAME)?=(?<value>.*)/.exec(line);
              const index = parseInt(match.groups.index) - 1;
              const key = match.groups.key === 'NAME' ? 'title' : 'startTime';
              const value = key === 'startTime' ? timestampToSeconds(match.groups.value) : match.groups.value;

              if (chapters[index]) {
                  chapters[index][key] = value;
              } else {
                  chapters[index] = {[key]: value};
              }

          });

          this.chapters = chapters;
      }

      toString() {
          return this.chapters.map((chapter, index) => {
              const i = zeroPad(index + 1, 2);
              const options = {
                  hours: true,
                  milliseconds: true
              };
              let output = [
                  `CHAPTER${i}=${secondsToTimestamp(chapter.startTime, options)}`
              ];
              if (chapter.title?.trim().length > 0) {
                  output.push(`CHAPTER${i}NAME=${chapter.title}`);
              }
              return output.join("\n");
          }).join("\n");
      }
  }

  class WebVTT extends FormatBase {

      filename = 'webvtt-chapters.txt';
      mimeType = 'text/plain';

      detect(inputString) {
          return inputString.trim().slice(0, 6) === 'WEBVTT';
      }

      parse(string) {
          if (!this.detect(string)) {
              throw new Error('WEBVTT header missing :(');
          }

          const lines = string.split(/\r?\n/)
              .filter(line => line.trim().length > 0)
              .map(line => line.trim());

          const header = lines.shift().split(/\s*-\s*/);


          if (header[1]) {
              this.meta.title = header[1];
          }

          let chapters = [];

          lines.forEach(line => {
              if (/^\d+$/.test(line)) {
                  chapters.push({});
                  return;
              }

              const index = chapters.length - 1;
              const timestamps = /(.*)\s+-->\s+(.*)/.exec(line);
              if (timestamps && timestamps.length === 3) {
                  chapters[index].startTime = timestampToSeconds(timestamps[1]);
                  chapters[index].endTime = timestampToSeconds(timestamps[2]);
                  return;
              }

              chapters[index].title = line;
          });

          this.chapters = chapters;
      }

      toString() {
          let output = ['WEBVTT'];
          if (this.meta.title.trim().length > 0) {
              output[0] += ' - ' + this.meta.title.trim();
          }
          const options = {hours: true, milliseconds: true};


          this.chapters.forEach((chapter, index) => {
              output.push('');
              output.push(...[
                      index + 1,
                      secondsToTimestamp(chapter.startTime, options) + ' --> ' + secondsToTimestamp(chapter.endTime, options),
                      chapter.title || this.getChapterTitle(index)
                  ].filter(line => String(line).trim().length > 0)
              );
          });

          return output.join("\n");
      }
  }

  class Youtube extends FormatBase {

      filename = "youtube-chapters.txt";
      mimeType = 'text/plain';

      detect(inputString) {
          return /^0?0:00/.test(inputString.trim());
      }

      parse(string) {
          if (!this.detect(string)) {
              throw new Error('Youtube Chapters *MUST* begin with (0)0:00');
          }
          this.chapters = this.stringToLines(string).map(line => {
              line = line.split(' ');
              return {
                  startTime: timestampToSeconds(line.shift(line)),
                  title: line.join(' ')
              }
          });

      }

      toString() {
          let options = {
              milliseconds: false,
              hours: this.chapters.at(-1).startTime > 3600
          };

          return this.chapters.map((chapter, index) => {
              const startTime = index === 0 && chapter.startTime !== 0 ? 0 : chapter.startTime;
              return `${secondsToTimestamp(startTime, options)} ${chapter.title || 'Chapter' + (index + 1)}`
          }).join("\n");
      }
  }

  class FFMpegInfo extends FormatBase {


      detect(inputString) {
          return /^frame:\d/.test(inputString.trim());
      }

      parse(input) {
          if (!this.detect(input)) {
              throw new Error('input must start with frame:')
          }

          const matches = Array.from(input.matchAll(/frame:(\d+).*pts_time:([\d.]+)\n/g));
          this.chapters = matches.map(match => {
              const startTime = enforceMilliseconds(parseFloat(match[2]));
              return {
                  startTime
              };
          });

          this.rebuildChapterTitles();
      }



      toString() {
          throw new Error(`this class won't generate actual output`)
      }
  }

  const AutoFormat = {
      classMap: {
          chaptersjson: ChaptersJson,
          ffmetadata: FFMetadata,
          matroskaxml: MatroskaXML,
          mkvmergexml: MKVMergeXML,
          mkvmergesimple: MKVMergeSimple,
          webvtt: WebVTT,
          youtube: Youtube,
          ffmpeginfo: FFMpegInfo
      },

      detect(inputString, returnWhat = 'instance') {
          let detected = false;

          Object.entries(this.classMap)
              .forEach(([key, className]) => {

                  if (detected) {
                      return;
                  }
                  try {
                      detected = new className(inputString);
                      if (detected) {
                          if (returnWhat === 'class') {
                              detected = className;
                          } else if (returnWhat === 'key') {
                              detected = key;
                          }
                      }
                  } catch (e) {
                      //do nothing
                  }
              });

          if (!detected) {
              throw new Error('failed to detect type of given input :(')
          }

          return detected;
      },

      from(inputString) {
          return this.detect(inputString);
      },

      as(classKeyOrClass, input) {
          if (typeof classKeyOrClass === 'string') {
              if (!(classKeyOrClass in this.classMap)) {
                  throw new Error(`invalid class key "${classKeyOrClass}"`);
              }
              return new this.classMap[classKeyOrClass](input);
          }

          return new classKeyOrClass(input);

      }


  };

  class FileHandler {

      editorHasProject = false;

      constructor() {

          document.documentElement.addEventListener('paste', e => {
              if (e.target.matches('input')) {
                  return;
              }

              const text = (e.clipboardData || window.clipboardData).getData('text');
              const files = [...(event.clipboardData || event.originalEvent.clipboardData).items]
                  .filter(item => item.kind === 'file')
                  .map(item => item.getAsFile());


              if (files[0]) {
                  return this.handleFile(files[0], 'paste')
              }

              try {
                  const url = new URL(text);
                  if (/(jpg|png|jpeg|webm|gif)$/.test(url.pathname)) {
                      gtag('event', 'paste', 'image-url');
                      return window.dispatchEvent(new CustomEvent('dragndrop:image', {
                          detail: {
                              image: url.toString(),
                              type: 'absolute',
                              name: url.toString()
                          }
                      }));
                  }
              } catch (e) {
                  //do nothing
              }

              try {
                  const detected = AutoFormat.from(text);
                  const data = new ChaptersJson(detected);
                  gtag('event', 'paste', 'data', detected.constructor.name);
                  return window.dispatchEvent(new CustomEvent('dragndrop:json', {
                      detail: {
                          data,
                          name: 'clipboard paste'
                      }
                  }));
              } catch (e) {
                  return window.dispatchEvent(new CustomEvent('dragndrop:jsonfail', {detail: {}}));
              }

          });

          document.getElementById('app').addEventListener('dragover', e => {
              e.preventDefault();
          });

          document.getElementById('app').addEventListener('drop', e => {
              // Prevent default behavior (Prevent file from being opened)
              e.preventDefault();

              if (e.dataTransfer.items) {
                  // Use DataTransferItemList interface to access the file(s)
                  [...e.dataTransfer.items].forEach((item, i) => {
                      if (item.kind === 'file' && i === 0) {
                          const file = item.getAsFile();
                          this.handleFile(file, 'dragdrop');
                      } else if (item.kind === 'file' && i > 1) {
                          window.dispatchEvent(new CustomEvent('dragndrop:ignoredfile', {detail: {filename: '...'}}));
                      }
                  });
              } else {
                  [...e.dataTransfer.files].forEach((file, i) => {
                      if (i === 0) {
                          return this.handleFile(file, 'dragdrop');
                      }
                      window.dispatchEvent(new CustomEvent('dragndrop:ignoredfile', {detail: {filename: file.name}}));
                  });
              }
          });
      }

      askForNewProject() {
          if (!this.editorHasProject) {
              return true;
          }
          return confirm('Do you want to discard the current project and start a new one?');
      }

      handleFile(file, origin = 'osDialog') {
          if (['text/plain', 'text/xml', 'application/json'].includes(file.type)) {
              fetch(URL.createObjectURL(file))
                  .then(r => r.text())
                  .then(text => {
                      try {
                          const detected = AutoFormat.from(text);
                          const data = new ChaptersJson(detected);
                          gtag('event', origin, 'data', detected.constructor.name);
                          return window.dispatchEvent(new CustomEvent('dragndrop:json', {
                              detail: {
                                  data,
                                  name: file.name
                              }
                          }));
                      } catch (e) {
                          // do nothing
                          return window.dispatchEvent(new CustomEvent('dragndrop:jsonfail', {detail: {}}));
                      }
                  });
          }

          if (file.type.slice(0, 5) === 'video') {

              gtag('event', origin, 'video');

              window.dispatchEvent(new CustomEvent('dragndrop:video', {
                  detail: {
                      video: URL.createObjectURL(file),
                      name: file.name
                  }
              }));
              return;
          }

          if (file.type.slice(0, 5) === 'audio' && this.askForNewProject()) {
              gtag('event', origin, 'audio');

              window.dispatchEvent(new CustomEvent('dragndrop:audio', {
                  detail: {
                      audio: URL.createObjectURL(file),
                      name: file.name
                  }
              }));
              return;
          }

          if (file.type.slice(0, 5) === 'image') {
              gtag('event', origin, 'image');

              window.dispatchEvent(new CustomEvent('dragndrop:image', {
                  detail: {
                      image: URL.createObjectURL(file),
                      name: file.name
                  }
              }));
              return;
          }


          window.dispatchEvent(new CustomEvent('dragndrop:ignoredfile', {detail: {filename: file.name}}));

      }

  }

  var MediaFeatures = {
      videoHandlersAttached: false,
      audioHandlersAttached: false,
      hasVideo: false,
      hasAudio: false,
      insertFrameOnSeek: false,
      ignoreNextSeekEvent: false,
      mediaIsCollapsed: false,
      actualMediaDuration: null,


      getVideoCanvas(callback) {
          const canvas = document.createElement('canvas');
          canvas.setAttribute('width', this.$refs.video.videoWidth);
          canvas.setAttribute('height', this.$refs.video.videoHeight);
          const context = canvas.getContext('2d');

          context.drawImage(this.$refs.video, 0, 0);
          canvas.toBlob(blob => {
              callback(URL.createObjectURL(blob));
          });
      },

      attachVideo(video, keepChapters = false) {
          if (!keepChapters) {
              this.reset();
          }

          this.importModal.hide();

          if (!this.videoHandlersAttached) {
              this.videoHandlersAttached = true;
              this.$refs.video.addEventListener('loadedmetadata', e => {
                  const videoDuration = e.target.duration;
                  if (keepChapters) {
                      this.actualMediaDuration = videoDuration;
                      console.log(this.actualMediaDuration);
                  } else {
                      this.data.duration = videoDuration;
                      this.actualMediaDuration = null;
                  }
                  this.currentChapterIndex = null;
                  this.data.bump();
                  this.updateTimeline();
              });

              this.$refs.video.addEventListener('seeked', e => {
                  if (this.insertFrameOnSeek) {
                      this.addImageFromVideoToChapter();
                      this.insertFrameOnSeek = false;

                      if (this.$refs.video.dataset.returnToTime) {
                          this.ignoreNextSeekEvent = true;
                          const seekTo = parseFloat(this.$refs.video.dataset.returnToTime);
                          delete this.$refs.video.dataset.returnToTime;
                          this.$refs.video.currentTime = seekTo;
                      }

                      if (this.$refs.video.dataset.resumeOnSeek === 'true') {
                          this.$refs.video.play();
                          delete this.$refs.video.dataset.resumeOnSeek;
                      }
                  } else {
                      if (this.ignoreNextSeekEvent) {
                          this.ignoreNextSeekEvent = false;
                      } else {
                          window.timeline.setMarkerAt(e.target.currentTime);
                      }
                  }
              });

              window.addEventListener('timeline:marker-set', e => {
                  this.ignoreNextSeekEvent = true;
                  this.$refs.video.currentTime = e.detail.time;
              });

          }

          this.hasVideo = true;
          this.mediaIsCollapsed = false;
          this.$refs.video.setAttribute('src', video);
          this.$refs.video.play();
      },

      fetchVideoSnapshot(startTime = false) {
          if (startTime === false) {
              startTime = this.$refs.video.currentTime;
          }
          this.insertFrameOnSeek = true;
          if (startTime !== this.$refs.video.currentTime) {
              this.$refs.video.dataset.returnToTime = this.$refs.video.currentTime;
          }

          if (this.$refs.video.paused === false) {
              this.$refs.video.dataset.resumeOnSeek = 'true';
              this.$refs.video.pause();
          }
          this.$refs.video.currentTime = startTime;
      },

      addImageFromVideoToChapter(index) {

          index = index || this.currentChapterIndex;

          gtag('event', 'videoStillToChapter');

          this.getVideoCanvas(url => {
              this.data.chapters[index].img = url;
              this.data.chapters[index].img_type = 'blob';
              this.data.chapters[index].img_filename = (new URL(url.slice(5)).pathname).slice(1) + '.png';
              this.getImageInfo(index);
          });
      },

      attachAudio(audio) {
          this.reset();
          if (!this.audioHandlersAttached) {
              this.audioHandlersAttached = true;
              this.$refs.audio.addEventListener('loadedmetadata', e => {
                  this.data.duration = e.target.duration;
                  this.updateTimeline();
              });
          }
          this.hasAudio = true;
          this.$refs.audio.setAttribute('src', audio);
          this.$refs.audio.play();
      },

      deleteImage(index) {

          if (this.data.chapters[index].img.slice(0, 5) === 'blob:') {
              URL.revokeObjectURL(this.data.chapters[index].img);
          }

          gtag('event', 'removeImage');

          delete this.data.chapters[index].img;
          delete this.data.chapters[index].img_type;
          delete this.data.chapters[index].img_filename;
      },

      getImageInfo(index) {
          const img = document.createElement('img');
          img.dataset.index = index;
          img.addEventListener('load', e => {
              this.data.chapters[e.target.dataset.index].img_dims = `${e.target.naturalWidth}x${e.target.naturalHeight}`;
          });
          img.setAttribute('src', this.data.chapters[index].img);

          const initObject = {index};
          fetch(this.data.chapters[index].img, initObject)
              .then(((initObject) => {
                  return r => {
                      const l = r.headers.get('content-length');
                      this.data.chapters[initObject.index].img_size = formatBytes(l) + ` (${l} Bytes)`;
                  }
              })(initObject));
      },
      toggleMedia(){
          this.mediaIsCollapsed = !this.mediaIsCollapsed;
          gtag('event','mediaToggle', this.mediaIsCollapsed ? 'collapsed' : 'visible');
          this.$refs.video.pause();
      }

  };

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  /*
   * This program is based on JZlib 1.0.2 ymnk, JCraft,Inc.
   * JZlib is based on zlib-1.1.3, so all credit should go authors
   * Jean-loup Gailly(jloup@gzip.org) and Mark Adler(madler@alumni.caltech.edu)
   * and contributors of zlib.
   */

  // deno-lint-ignore-file no-this-alias prefer-const

  // Global

  const MAX_BITS$1 = 15;
  const D_CODES = 30;
  const BL_CODES = 19;

  const LENGTH_CODES = 29;
  const LITERALS = 256;
  const L_CODES = (LITERALS + 1 + LENGTH_CODES);
  const HEAP_SIZE = (2 * L_CODES + 1);

  const END_BLOCK = 256;

  // Bit length codes must not exceed MAX_BL_BITS bits
  const MAX_BL_BITS = 7;

  // repeat previous bit length 3-6 times (2 bits of repeat count)
  const REP_3_6 = 16;

  // repeat a zero length 3-10 times (3 bits of repeat count)
  const REPZ_3_10 = 17;

  // repeat a zero length 11-138 times (7 bits of repeat count)
  const REPZ_11_138 = 18;

  // The lengths of the bit length codes are sent in order of decreasing
  // probability, to avoid transmitting the lengths for unused bit
  // length codes.

  const Buf_size = 8 * 2;

  // JZlib version : "1.0.2"
  const Z_DEFAULT_COMPRESSION = -1;

  // compression strategy
  const Z_FILTERED = 1;
  const Z_HUFFMAN_ONLY = 2;
  const Z_DEFAULT_STRATEGY = 0;

  const Z_NO_FLUSH$1 = 0;
  const Z_PARTIAL_FLUSH = 1;
  const Z_FULL_FLUSH = 3;
  const Z_FINISH$1 = 4;

  const Z_OK$1 = 0;
  const Z_STREAM_END$1 = 1;
  const Z_NEED_DICT$1 = 2;
  const Z_STREAM_ERROR$1 = -2;
  const Z_DATA_ERROR$1 = -3;
  const Z_BUF_ERROR$1 = -5;

  // Tree

  function extractArray(array) {
  	return flatArray(array.map(([length, value]) => (new Array(length)).fill(value, 0, length)));
  }

  function flatArray(array) {
  	return array.reduce((a, b) => a.concat(Array.isArray(b) ? flatArray(b) : b), []);
  }

  // see definition of array dist_code below
  const _dist_code = [0, 1, 2, 3].concat(...extractArray([
  	[2, 4], [2, 5], [4, 6], [4, 7], [8, 8], [8, 9], [16, 10], [16, 11], [32, 12], [32, 13], [64, 14], [64, 15], [2, 0], [1, 16],
  	[1, 17], [2, 18], [2, 19], [4, 20], [4, 21], [8, 22], [8, 23], [16, 24], [16, 25], [32, 26], [32, 27], [64, 28], [64, 29]
  ]));

  function Tree() {
  	const that = this;

  	// dyn_tree; // the dynamic tree
  	// max_code; // largest code with non zero frequency
  	// stat_desc; // the corresponding static tree

  	// Compute the optimal bit lengths for a tree and update the total bit
  	// length
  	// for the current block.
  	// IN assertion: the fields freq and dad are set, heap[heap_max] and
  	// above are the tree nodes sorted by increasing frequency.
  	// OUT assertions: the field len is set to the optimal bit length, the
  	// array bl_count contains the frequencies for each bit length.
  	// The length opt_len is updated; static_len is also updated if stree is
  	// not null.
  	function gen_bitlen(s) {
  		const tree = that.dyn_tree;
  		const stree = that.stat_desc.static_tree;
  		const extra = that.stat_desc.extra_bits;
  		const base = that.stat_desc.extra_base;
  		const max_length = that.stat_desc.max_length;
  		let h; // heap index
  		let n, m; // iterate over the tree elements
  		let bits; // bit length
  		let xbits; // extra bits
  		let f; // frequency
  		let overflow = 0; // number of elements with bit length too large

  		for (bits = 0; bits <= MAX_BITS$1; bits++)
  			s.bl_count[bits] = 0;

  		// In a first pass, compute the optimal bit lengths (which may
  		// overflow in the case of the bit length tree).
  		tree[s.heap[s.heap_max] * 2 + 1] = 0; // root of the heap

  		for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
  			n = s.heap[h];
  			bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
  			if (bits > max_length) {
  				bits = max_length;
  				overflow++;
  			}
  			tree[n * 2 + 1] = bits;
  			// We overwrite tree[n*2+1] which is no longer needed

  			if (n > that.max_code)
  				continue; // not a leaf node

  			s.bl_count[bits]++;
  			xbits = 0;
  			if (n >= base)
  				xbits = extra[n - base];
  			f = tree[n * 2];
  			s.opt_len += f * (bits + xbits);
  			if (stree)
  				s.static_len += f * (stree[n * 2 + 1] + xbits);
  		}
  		if (overflow === 0)
  			return;

  		// This happens for example on obj2 and pic of the Calgary corpus
  		// Find the first bit length which could increase:
  		do {
  			bits = max_length - 1;
  			while (s.bl_count[bits] === 0)
  				bits--;
  			s.bl_count[bits]--; // move one leaf down the tree
  			s.bl_count[bits + 1] += 2; // move one overflow item as its brother
  			s.bl_count[max_length]--;
  			// The brother of the overflow item also moves one step up,
  			// but this does not affect bl_count[max_length]
  			overflow -= 2;
  		} while (overflow > 0);

  		for (bits = max_length; bits !== 0; bits--) {
  			n = s.bl_count[bits];
  			while (n !== 0) {
  				m = s.heap[--h];
  				if (m > that.max_code)
  					continue;
  				if (tree[m * 2 + 1] != bits) {
  					s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
  					tree[m * 2 + 1] = bits;
  				}
  				n--;
  			}
  		}
  	}

  	// Reverse the first len bits of a code, using straightforward code (a
  	// faster
  	// method would use a table)
  	// IN assertion: 1 <= len <= 15
  	function bi_reverse(code, // the value to invert
  		len // its bit length
  	) {
  		let res = 0;
  		do {
  			res |= code & 1;
  			code >>>= 1;
  			res <<= 1;
  		} while (--len > 0);
  		return res >>> 1;
  	}

  	// Generate the codes for a given tree and bit counts (which need not be
  	// optimal).
  	// IN assertion: the array bl_count contains the bit length statistics for
  	// the given tree and the field len is set for all tree elements.
  	// OUT assertion: the field code is set for all tree elements of non
  	// zero code length.
  	function gen_codes(tree, // the tree to decorate
  		max_code, // largest code with non zero frequency
  		bl_count // number of codes at each bit length
  	) {
  		const next_code = []; // next code value for each
  		// bit length
  		let code = 0; // running code value
  		let bits; // bit index
  		let n; // code index
  		let len;

  		// The distribution counts are first used to generate the code values
  		// without bit reversal.
  		for (bits = 1; bits <= MAX_BITS$1; bits++) {
  			next_code[bits] = code = ((code + bl_count[bits - 1]) << 1);
  		}

  		// Check that the bit counts in bl_count are consistent. The last code
  		// must be all ones.
  		// Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  		// "inconsistent bit counts");
  		// Tracev((stderr,"gen_codes: max_code %d ", max_code));

  		for (n = 0; n <= max_code; n++) {
  			len = tree[n * 2 + 1];
  			if (len === 0)
  				continue;
  			// Now reverse the bits
  			tree[n * 2] = bi_reverse(next_code[len]++, len);
  		}
  	}

  	// Construct one Huffman tree and assigns the code bit strings and lengths.
  	// Update the total bit length for the current block.
  	// IN assertion: the field freq is set for all tree elements.
  	// OUT assertions: the fields len and code are set to the optimal bit length
  	// and corresponding code. The length opt_len is updated; static_len is
  	// also updated if stree is not null. The field max_code is set.
  	that.build_tree = function (s) {
  		const tree = that.dyn_tree;
  		const stree = that.stat_desc.static_tree;
  		const elems = that.stat_desc.elems;
  		let n, m; // iterate over heap elements
  		let max_code = -1; // largest code with non zero frequency
  		let node; // new node being created

  		// Construct the initial heap, with least frequent element in
  		// heap[1]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
  		// heap[0] is not used.
  		s.heap_len = 0;
  		s.heap_max = HEAP_SIZE;

  		for (n = 0; n < elems; n++) {
  			if (tree[n * 2] !== 0) {
  				s.heap[++s.heap_len] = max_code = n;
  				s.depth[n] = 0;
  			} else {
  				tree[n * 2 + 1] = 0;
  			}
  		}

  		// The pkzip format requires that at least one distance code exists,
  		// and that at least one bit should be sent even if there is only one
  		// possible code. So to avoid special checks later on we force at least
  		// two codes of non zero frequency.
  		while (s.heap_len < 2) {
  			node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
  			tree[node * 2] = 1;
  			s.depth[node] = 0;
  			s.opt_len--;
  			if (stree)
  				s.static_len -= stree[node * 2 + 1];
  			// node is 0 or 1 so it does not have extra bits
  		}
  		that.max_code = max_code;

  		// The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
  		// establish sub-heaps of increasing lengths:

  		for (n = Math.floor(s.heap_len / 2); n >= 1; n--)
  			s.pqdownheap(tree, n);

  		// Construct the Huffman tree by repeatedly combining the least two
  		// frequent nodes.

  		node = elems; // next internal node of the tree
  		do {
  			// n = node of least frequency
  			n = s.heap[1];
  			s.heap[1] = s.heap[s.heap_len--];
  			s.pqdownheap(tree, 1);
  			m = s.heap[1]; // m = node of next least frequency

  			s.heap[--s.heap_max] = n; // keep the nodes sorted by frequency
  			s.heap[--s.heap_max] = m;

  			// Create a new node father of n and m
  			tree[node * 2] = (tree[n * 2] + tree[m * 2]);
  			s.depth[node] = Math.max(s.depth[n], s.depth[m]) + 1;
  			tree[n * 2 + 1] = tree[m * 2 + 1] = node;

  			// and insert the new node in the heap
  			s.heap[1] = node++;
  			s.pqdownheap(tree, 1);
  		} while (s.heap_len >= 2);

  		s.heap[--s.heap_max] = s.heap[1];

  		// At this point, the fields freq and dad are set. We can now
  		// generate the bit lengths.

  		gen_bitlen(s);

  		// The field len is now set, we can generate the bit codes
  		gen_codes(tree, that.max_code, s.bl_count);
  	};

  }

  Tree._length_code = [0, 1, 2, 3, 4, 5, 6, 7].concat(...extractArray([
  	[2, 8], [2, 9], [2, 10], [2, 11], [4, 12], [4, 13], [4, 14], [4, 15], [8, 16], [8, 17], [8, 18], [8, 19],
  	[16, 20], [16, 21], [16, 22], [16, 23], [32, 24], [32, 25], [32, 26], [31, 27], [1, 28]]));

  Tree.base_length = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 0];

  Tree.base_dist = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384,
  	24576];

  // Mapping from a distance to a distance code. dist is the distance - 1 and
  // must not have side effects. _dist_code[256] and _dist_code[257] are never
  // used.
  Tree.d_code = function (dist) {
  	return ((dist) < 256 ? _dist_code[dist] : _dist_code[256 + ((dist) >>> 7)]);
  };

  // extra bits for each length code
  Tree.extra_lbits = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];

  // extra bits for each distance code
  Tree.extra_dbits = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  // extra bits for each bit length code
  Tree.extra_blbits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];

  Tree.bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  // StaticTree

  function StaticTree(static_tree, extra_bits, extra_base, elems, max_length) {
  	const that = this;
  	that.static_tree = static_tree;
  	that.extra_bits = extra_bits;
  	that.extra_base = extra_base;
  	that.elems = elems;
  	that.max_length = max_length;
  }

  const static_ltree2_first_part = [12, 140, 76, 204, 44, 172, 108, 236, 28, 156, 92, 220, 60, 188, 124, 252, 2, 130, 66, 194, 34, 162, 98, 226, 18, 146, 82,
  	210, 50, 178, 114, 242, 10, 138, 74, 202, 42, 170, 106, 234, 26, 154, 90, 218, 58, 186, 122, 250, 6, 134, 70, 198, 38, 166, 102, 230, 22, 150, 86,
  	214, 54, 182, 118, 246, 14, 142, 78, 206, 46, 174, 110, 238, 30, 158, 94, 222, 62, 190, 126, 254, 1, 129, 65, 193, 33, 161, 97, 225, 17, 145, 81,
  	209, 49, 177, 113, 241, 9, 137, 73, 201, 41, 169, 105, 233, 25, 153, 89, 217, 57, 185, 121, 249, 5, 133, 69, 197, 37, 165, 101, 229, 21, 149, 85,
  	213, 53, 181, 117, 245, 13, 141, 77, 205, 45, 173, 109, 237, 29, 157, 93, 221, 61, 189, 125, 253, 19, 275, 147, 403, 83, 339, 211, 467, 51, 307,
  	179, 435, 115, 371, 243, 499, 11, 267, 139, 395, 75, 331, 203, 459, 43, 299, 171, 427, 107, 363, 235, 491, 27, 283, 155, 411, 91, 347, 219, 475,
  	59, 315, 187, 443, 123, 379, 251, 507, 7, 263, 135, 391, 71, 327, 199, 455, 39, 295, 167, 423, 103, 359, 231, 487, 23, 279, 151, 407, 87, 343, 215,
  	471, 55, 311, 183, 439, 119, 375, 247, 503, 15, 271, 143, 399, 79, 335, 207, 463, 47, 303, 175, 431, 111, 367, 239, 495, 31, 287, 159, 415, 95,
  	351, 223, 479, 63, 319, 191, 447, 127, 383, 255, 511, 0, 64, 32, 96, 16, 80, 48, 112, 8, 72, 40, 104, 24, 88, 56, 120, 4, 68, 36, 100, 20, 84, 52,
  	116, 3, 131, 67, 195, 35, 163, 99, 227];
  const static_ltree2_second_part = extractArray([[144, 8], [112, 9], [24, 7], [8, 8]]);
  StaticTree.static_ltree = flatArray(static_ltree2_first_part.map((value, index) => [value, static_ltree2_second_part[index]]));

  const static_dtree_first_part = [0, 16, 8, 24, 4, 20, 12, 28, 2, 18, 10, 26, 6, 22, 14, 30, 1, 17, 9, 25, 5, 21, 13, 29, 3, 19, 11, 27, 7, 23];
  const static_dtree_second_part = extractArray([[30, 5]]);
  StaticTree.static_dtree = flatArray(static_dtree_first_part.map((value, index) => [value, static_dtree_second_part[index]]));

  StaticTree.static_l_desc = new StaticTree(StaticTree.static_ltree, Tree.extra_lbits, LITERALS + 1, L_CODES, MAX_BITS$1);

  StaticTree.static_d_desc = new StaticTree(StaticTree.static_dtree, Tree.extra_dbits, 0, D_CODES, MAX_BITS$1);

  StaticTree.static_bl_desc = new StaticTree(null, Tree.extra_blbits, 0, BL_CODES, MAX_BL_BITS);

  // Deflate

  const MAX_MEM_LEVEL = 9;
  const DEF_MEM_LEVEL = 8;

  function Config(good_length, max_lazy, nice_length, max_chain, func) {
  	const that = this;
  	that.good_length = good_length;
  	that.max_lazy = max_lazy;
  	that.nice_length = nice_length;
  	that.max_chain = max_chain;
  	that.func = func;
  }

  const STORED$1 = 0;
  const FAST = 1;
  const SLOW = 2;
  const config_table = [
  	new Config(0, 0, 0, 0, STORED$1),
  	new Config(4, 4, 8, 4, FAST),
  	new Config(4, 5, 16, 8, FAST),
  	new Config(4, 6, 32, 32, FAST),
  	new Config(4, 4, 16, 16, SLOW),
  	new Config(8, 16, 32, 32, SLOW),
  	new Config(8, 16, 128, 128, SLOW),
  	new Config(8, 32, 128, 256, SLOW),
  	new Config(32, 128, 258, 1024, SLOW),
  	new Config(32, 258, 258, 4096, SLOW)
  ];

  const z_errmsg = ["need dictionary", // Z_NEED_DICT
  	// 2
  	"stream end", // Z_STREAM_END 1
  	"", // Z_OK 0
  	"", // Z_ERRNO (-1)
  	"stream error", // Z_STREAM_ERROR (-2)
  	"data error", // Z_DATA_ERROR (-3)
  	"", // Z_MEM_ERROR (-4)
  	"buffer error", // Z_BUF_ERROR (-5)
  	"",// Z_VERSION_ERROR (-6)
  	""];

  // block not completed, need more input or more output
  const NeedMore = 0;

  // block flush performed
  const BlockDone = 1;

  // finish started, need only more output at next deflate
  const FinishStarted = 2;

  // finish done, accept no more input or output
  const FinishDone = 3;

  // preset dictionary flag in zlib header
  const PRESET_DICT$1 = 0x20;

  const INIT_STATE = 42;
  const BUSY_STATE = 113;
  const FINISH_STATE = 666;

  // The deflate compression method
  const Z_DEFLATED$1 = 8;

  const STORED_BLOCK = 0;
  const STATIC_TREES = 1;
  const DYN_TREES = 2;

  const MIN_MATCH = 3;
  const MAX_MATCH = 258;
  const MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

  function smaller(tree, n, m, depth) {
  	const tn2 = tree[n * 2];
  	const tm2 = tree[m * 2];
  	return (tn2 < tm2 || (tn2 == tm2 && depth[n] <= depth[m]));
  }

  function Deflate() {

  	const that = this;
  	let strm; // pointer back to this zlib stream
  	let status; // as the name implies
  	// pending_buf; // output still pending
  	let pending_buf_size; // size of pending_buf
  	// pending_out; // next pending byte to output to the stream
  	// pending; // nb of bytes in the pending buffer

  	// dist_buf; // buffer for distances
  	// lc_buf; // buffer for literals or lengths
  	// To simplify the code, dist_buf and lc_buf have the same number of elements.
  	// To use different lengths, an extra flag array would be necessary.

  	let last_flush; // value of flush param for previous deflate call

  	let w_size; // LZ77 win size (32K by default)
  	let w_bits; // log2(w_size) (8..16)
  	let w_mask; // w_size - 1

  	let win;
  	// Sliding win. Input bytes are read into the second half of the win,
  	// and move to the first half later to keep a dictionary of at least wSize
  	// bytes. With this organization, matches are limited to a distance of
  	// wSize-MAX_MATCH bytes, but this ensures that IO is always
  	// performed with a length multiple of the block size. Also, it limits
  	// the win size to 64K, which is quite useful on MSDOS.
  	// To do: use the user input buffer as sliding win.

  	let window_size;
  	// Actual size of win: 2*wSize, except when the user input buffer
  	// is directly used as sliding win.

  	let prev;
  	// Link to older string with same hash index. To limit the size of this
  	// array to 64K, this link is maintained only for the last 32K strings.
  	// An index in this array is thus a win index modulo 32K.

  	let head; // Heads of the hash chains or NIL.

  	let ins_h; // hash index of string to be inserted
  	let hash_size; // number of elements in hash table
  	let hash_bits; // log2(hash_size)
  	let hash_mask; // hash_size-1

  	// Number of bits by which ins_h must be shifted at each input
  	// step. It must be such that after MIN_MATCH steps, the oldest
  	// byte no longer takes part in the hash key, that is:
  	// hash_shift * MIN_MATCH >= hash_bits
  	let hash_shift;

  	// Window position at the beginning of the current output block. Gets
  	// negative when the win is moved backwards.

  	let block_start;

  	let match_length; // length of best match
  	let prev_match; // previous match
  	let match_available; // set if previous match exists
  	let strstart; // start of string to insert
  	let match_start; // start of matching string
  	let lookahead; // number of valid bytes ahead in win

  	// Length of the best match at previous step. Matches not greater than this
  	// are discarded. This is used in the lazy match evaluation.
  	let prev_length;

  	// To speed up deflation, hash chains are never searched beyond this
  	// length. A higher limit improves compression ratio but degrades the speed.
  	let max_chain_length;

  	// Attempt to find a better match only when the current match is strictly
  	// smaller than this value. This mechanism is used only for compression
  	// levels >= 4.
  	let max_lazy_match;

  	// Insert new strings in the hash table only if the match length is not
  	// greater than this length. This saves time but degrades compression.
  	// max_insert_length is used only for compression levels <= 3.

  	let level; // compression level (1..9)
  	let strategy; // favor or force Huffman coding

  	// Use a faster search when the previous match is longer than this
  	let good_match;

  	// Stop searching when current match exceeds this
  	let nice_match;

  	let dyn_ltree; // literal and length tree
  	let dyn_dtree; // distance tree
  	let bl_tree; // Huffman tree for bit lengths

  	const l_desc = new Tree(); // desc for literal tree
  	const d_desc = new Tree(); // desc for distance tree
  	const bl_desc = new Tree(); // desc for bit length tree

  	// that.heap_len; // number of elements in the heap
  	// that.heap_max; // element of largest frequency
  	// The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
  	// The same heap array is used to build all trees.

  	// Depth of each subtree used as tie breaker for trees of equal frequency
  	that.depth = [];

  	// Size of match buffer for literals/lengths. There are 4 reasons for
  	// limiting lit_bufsize to 64K:
  	// - frequencies can be kept in 16 bit counters
  	// - if compression is not successful for the first block, all input
  	// data is still in the win so we can still emit a stored block even
  	// when input comes from standard input. (This can also be done for
  	// all blocks if lit_bufsize is not greater than 32K.)
  	// - if compression is not successful for a file smaller than 64K, we can
  	// even emit a stored file instead of a stored block (saving 5 bytes).
  	// This is applicable only for zip (not gzip or zlib).
  	// - creating new Huffman trees less frequently may not provide fast
  	// adaptation to changes in the input data statistics. (Take for
  	// example a binary file with poorly compressible code followed by
  	// a highly compressible string table.) Smaller buffer sizes give
  	// fast adaptation but have of course the overhead of transmitting
  	// trees more frequently.
  	// - I can't count above 4
  	let lit_bufsize;

  	let last_lit; // running index in dist_buf and lc_buf

  	// that.opt_len; // bit length of current block with optimal trees
  	// that.static_len; // bit length of current block with static trees
  	let matches; // number of string matches in current block
  	let last_eob_len; // bit length of EOB code for last block

  	// Output buffer. bits are inserted starting at the bottom (least
  	// significant bits).
  	let bi_buf;

  	// Number of valid bits in bi_buf. All bits above the last valid bit
  	// are always zero.
  	let bi_valid;

  	// number of codes at each bit length for an optimal tree
  	that.bl_count = [];

  	// heap used to build the Huffman trees
  	that.heap = [];

  	dyn_ltree = [];
  	dyn_dtree = [];
  	bl_tree = [];

  	function lm_init() {
  		window_size = 2 * w_size;

  		head[hash_size - 1] = 0;
  		for (let i = 0; i < hash_size - 1; i++) {
  			head[i] = 0;
  		}

  		// Set the default configuration parameters:
  		max_lazy_match = config_table[level].max_lazy;
  		good_match = config_table[level].good_length;
  		nice_match = config_table[level].nice_length;
  		max_chain_length = config_table[level].max_chain;

  		strstart = 0;
  		block_start = 0;
  		lookahead = 0;
  		match_length = prev_length = MIN_MATCH - 1;
  		match_available = 0;
  		ins_h = 0;
  	}

  	function init_block() {
  		let i;
  		// Initialize the trees.
  		for (i = 0; i < L_CODES; i++)
  			dyn_ltree[i * 2] = 0;
  		for (i = 0; i < D_CODES; i++)
  			dyn_dtree[i * 2] = 0;
  		for (i = 0; i < BL_CODES; i++)
  			bl_tree[i * 2] = 0;

  		dyn_ltree[END_BLOCK * 2] = 1;
  		that.opt_len = that.static_len = 0;
  		last_lit = matches = 0;
  	}

  	// Initialize the tree data structures for a new zlib stream.
  	function tr_init() {

  		l_desc.dyn_tree = dyn_ltree;
  		l_desc.stat_desc = StaticTree.static_l_desc;

  		d_desc.dyn_tree = dyn_dtree;
  		d_desc.stat_desc = StaticTree.static_d_desc;

  		bl_desc.dyn_tree = bl_tree;
  		bl_desc.stat_desc = StaticTree.static_bl_desc;

  		bi_buf = 0;
  		bi_valid = 0;
  		last_eob_len = 8; // enough lookahead for inflate

  		// Initialize the first block of the first file:
  		init_block();
  	}

  	// Restore the heap property by moving down the tree starting at node k,
  	// exchanging a node with the smallest of its two sons if necessary,
  	// stopping
  	// when the heap property is re-established (each father smaller than its
  	// two sons).
  	that.pqdownheap = function (tree, // the tree to restore
  		k // node to move down
  	) {
  		const heap = that.heap;
  		const v = heap[k];
  		let j = k << 1; // left son of k
  		while (j <= that.heap_len) {
  			// Set j to the smallest of the two sons:
  			if (j < that.heap_len && smaller(tree, heap[j + 1], heap[j], that.depth)) {
  				j++;
  			}
  			// Exit if v is smaller than both sons
  			if (smaller(tree, v, heap[j], that.depth))
  				break;

  			// Exchange v with the smallest son
  			heap[k] = heap[j];
  			k = j;
  			// And continue down the tree, setting j to the left son of k
  			j <<= 1;
  		}
  		heap[k] = v;
  	};

  	// Scan a literal or distance tree to determine the frequencies of the codes
  	// in the bit length tree.
  	function scan_tree(tree,// the tree to be scanned
  		max_code // and its largest code of non zero frequency
  	) {
  		let prevlen = -1; // last emitted length
  		let curlen; // length of current code
  		let nextlen = tree[0 * 2 + 1]; // length of next code
  		let count = 0; // repeat count of the current code
  		let max_count = 7; // max repeat count
  		let min_count = 4; // min repeat count

  		if (nextlen === 0) {
  			max_count = 138;
  			min_count = 3;
  		}
  		tree[(max_code + 1) * 2 + 1] = 0xffff; // guard

  		for (let n = 0; n <= max_code; n++) {
  			curlen = nextlen;
  			nextlen = tree[(n + 1) * 2 + 1];
  			if (++count < max_count && curlen == nextlen) {
  				continue;
  			} else if (count < min_count) {
  				bl_tree[curlen * 2] += count;
  			} else if (curlen !== 0) {
  				if (curlen != prevlen)
  					bl_tree[curlen * 2]++;
  				bl_tree[REP_3_6 * 2]++;
  			} else if (count <= 10) {
  				bl_tree[REPZ_3_10 * 2]++;
  			} else {
  				bl_tree[REPZ_11_138 * 2]++;
  			}
  			count = 0;
  			prevlen = curlen;
  			if (nextlen === 0) {
  				max_count = 138;
  				min_count = 3;
  			} else if (curlen == nextlen) {
  				max_count = 6;
  				min_count = 3;
  			} else {
  				max_count = 7;
  				min_count = 4;
  			}
  		}
  	}

  	// Construct the Huffman tree for the bit lengths and return the index in
  	// bl_order of the last bit length code to send.
  	function build_bl_tree() {
  		let max_blindex; // index of last bit length code of non zero freq

  		// Determine the bit length frequencies for literal and distance trees
  		scan_tree(dyn_ltree, l_desc.max_code);
  		scan_tree(dyn_dtree, d_desc.max_code);

  		// Build the bit length tree:
  		bl_desc.build_tree(that);
  		// opt_len now includes the length of the tree representations, except
  		// the lengths of the bit lengths codes and the 5+5+4 bits for the
  		// counts.

  		// Determine the number of bit length codes to send. The pkzip format
  		// requires that at least 4 bit length codes be sent. (appnote.txt says
  		// 3 but the actual value used is 4.)
  		for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
  			if (bl_tree[Tree.bl_order[max_blindex] * 2 + 1] !== 0)
  				break;
  		}
  		// Update opt_len to include the bit length tree and counts
  		that.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;

  		return max_blindex;
  	}

  	// Output a byte on the stream.
  	// IN assertion: there is enough room in pending_buf.
  	function put_byte(p) {
  		that.pending_buf[that.pending++] = p;
  	}

  	function put_short(w) {
  		put_byte(w & 0xff);
  		put_byte((w >>> 8) & 0xff);
  	}

  	function putShortMSB(b) {
  		put_byte((b >> 8) & 0xff);
  		put_byte((b & 0xff) & 0xff);
  	}

  	function send_bits(value, length) {
  		let val;
  		const len = length;
  		if (bi_valid > Buf_size - len) {
  			val = value;
  			// bi_buf |= (val << bi_valid);
  			bi_buf |= ((val << bi_valid) & 0xffff);
  			put_short(bi_buf);
  			bi_buf = val >>> (Buf_size - bi_valid);
  			bi_valid += len - Buf_size;
  		} else {
  			// bi_buf |= (value) << bi_valid;
  			bi_buf |= (((value) << bi_valid) & 0xffff);
  			bi_valid += len;
  		}
  	}

  	function send_code(c, tree) {
  		const c2 = c * 2;
  		send_bits(tree[c2] & 0xffff, tree[c2 + 1] & 0xffff);
  	}

  	// Send a literal or distance tree in compressed form, using the codes in
  	// bl_tree.
  	function send_tree(tree,// the tree to be sent
  		max_code // and its largest code of non zero frequency
  	) {
  		let n; // iterates over all tree elements
  		let prevlen = -1; // last emitted length
  		let curlen; // length of current code
  		let nextlen = tree[0 * 2 + 1]; // length of next code
  		let count = 0; // repeat count of the current code
  		let max_count = 7; // max repeat count
  		let min_count = 4; // min repeat count

  		if (nextlen === 0) {
  			max_count = 138;
  			min_count = 3;
  		}

  		for (n = 0; n <= max_code; n++) {
  			curlen = nextlen;
  			nextlen = tree[(n + 1) * 2 + 1];
  			if (++count < max_count && curlen == nextlen) {
  				continue;
  			} else if (count < min_count) {
  				do {
  					send_code(curlen, bl_tree);
  				} while (--count !== 0);
  			} else if (curlen !== 0) {
  				if (curlen != prevlen) {
  					send_code(curlen, bl_tree);
  					count--;
  				}
  				send_code(REP_3_6, bl_tree);
  				send_bits(count - 3, 2);
  			} else if (count <= 10) {
  				send_code(REPZ_3_10, bl_tree);
  				send_bits(count - 3, 3);
  			} else {
  				send_code(REPZ_11_138, bl_tree);
  				send_bits(count - 11, 7);
  			}
  			count = 0;
  			prevlen = curlen;
  			if (nextlen === 0) {
  				max_count = 138;
  				min_count = 3;
  			} else if (curlen == nextlen) {
  				max_count = 6;
  				min_count = 3;
  			} else {
  				max_count = 7;
  				min_count = 4;
  			}
  		}
  	}

  	// Send the header for a block using dynamic Huffman trees: the counts, the
  	// lengths of the bit length codes, the literal tree and the distance tree.
  	// IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
  	function send_all_trees(lcodes, dcodes, blcodes) {
  		let rank; // index in bl_order

  		send_bits(lcodes - 257, 5); // not +255 as stated in appnote.txt
  		send_bits(dcodes - 1, 5);
  		send_bits(blcodes - 4, 4); // not -3 as stated in appnote.txt
  		for (rank = 0; rank < blcodes; rank++) {
  			send_bits(bl_tree[Tree.bl_order[rank] * 2 + 1], 3);
  		}
  		send_tree(dyn_ltree, lcodes - 1); // literal tree
  		send_tree(dyn_dtree, dcodes - 1); // distance tree
  	}

  	// Flush the bit buffer, keeping at most 7 bits in it.
  	function bi_flush() {
  		if (bi_valid == 16) {
  			put_short(bi_buf);
  			bi_buf = 0;
  			bi_valid = 0;
  		} else if (bi_valid >= 8) {
  			put_byte(bi_buf & 0xff);
  			bi_buf >>>= 8;
  			bi_valid -= 8;
  		}
  	}

  	// Send one empty static block to give enough lookahead for inflate.
  	// This takes 10 bits, of which 7 may remain in the bit buffer.
  	// The current inflate code requires 9 bits of lookahead. If the
  	// last two codes for the previous block (real code plus EOB) were coded
  	// on 5 bits or less, inflate may have only 5+3 bits of lookahead to decode
  	// the last real code. In this case we send two empty static blocks instead
  	// of one. (There are no problems if the previous block is stored or fixed.)
  	// To simplify the code, we assume the worst case of last real code encoded
  	// on one bit only.
  	function _tr_align() {
  		send_bits(STATIC_TREES << 1, 3);
  		send_code(END_BLOCK, StaticTree.static_ltree);

  		bi_flush();

  		// Of the 10 bits for the empty block, we have already sent
  		// (10 - bi_valid) bits. The lookahead for the last real code (before
  		// the EOB of the previous block) was thus at least one plus the length
  		// of the EOB plus what we have just sent of the empty static block.
  		if (1 + last_eob_len + 10 - bi_valid < 9) {
  			send_bits(STATIC_TREES << 1, 3);
  			send_code(END_BLOCK, StaticTree.static_ltree);
  			bi_flush();
  		}
  		last_eob_len = 7;
  	}

  	// Save the match info and tally the frequency counts. Return true if
  	// the current block must be flushed.
  	function _tr_tally(dist, // distance of matched string
  		lc // match length-MIN_MATCH or unmatched char (if dist==0)
  	) {
  		let out_length, in_length, dcode;
  		that.dist_buf[last_lit] = dist;
  		that.lc_buf[last_lit] = lc & 0xff;
  		last_lit++;

  		if (dist === 0) {
  			// lc is the unmatched char
  			dyn_ltree[lc * 2]++;
  		} else {
  			matches++;
  			// Here, lc is the match length - MIN_MATCH
  			dist--; // dist = match distance - 1
  			dyn_ltree[(Tree._length_code[lc] + LITERALS + 1) * 2]++;
  			dyn_dtree[Tree.d_code(dist) * 2]++;
  		}

  		if ((last_lit & 0x1fff) === 0 && level > 2) {
  			// Compute an upper bound for the compressed length
  			out_length = last_lit * 8;
  			in_length = strstart - block_start;
  			for (dcode = 0; dcode < D_CODES; dcode++) {
  				out_length += dyn_dtree[dcode * 2] * (5 + Tree.extra_dbits[dcode]);
  			}
  			out_length >>>= 3;
  			if ((matches < Math.floor(last_lit / 2)) && out_length < Math.floor(in_length / 2))
  				return true;
  		}

  		return (last_lit == lit_bufsize - 1);
  		// We avoid equality with lit_bufsize because of wraparound at 64K
  		// on 16 bit machines and because stored blocks are restricted to
  		// 64K-1 bytes.
  	}

  	// Send the block data compressed using the given Huffman trees
  	function compress_block(ltree, dtree) {
  		let dist; // distance of matched string
  		let lc; // match length or unmatched char (if dist === 0)
  		let lx = 0; // running index in dist_buf and lc_buf
  		let code; // the code to send
  		let extra; // number of extra bits to send

  		if (last_lit !== 0) {
  			do {
  				dist = that.dist_buf[lx];
  				lc = that.lc_buf[lx];
  				lx++;

  				if (dist === 0) {
  					send_code(lc, ltree); // send a literal byte
  				} else {
  					// Here, lc is the match length - MIN_MATCH
  					code = Tree._length_code[lc];

  					send_code(code + LITERALS + 1, ltree); // send the length
  					// code
  					extra = Tree.extra_lbits[code];
  					if (extra !== 0) {
  						lc -= Tree.base_length[code];
  						send_bits(lc, extra); // send the extra length bits
  					}
  					dist--; // dist is now the match distance - 1
  					code = Tree.d_code(dist);

  					send_code(code, dtree); // send the distance code
  					extra = Tree.extra_dbits[code];
  					if (extra !== 0) {
  						dist -= Tree.base_dist[code];
  						send_bits(dist, extra); // send the extra distance bits
  					}
  				} // literal or match pair ?
  			} while (lx < last_lit);
  		}

  		send_code(END_BLOCK, ltree);
  		last_eob_len = ltree[END_BLOCK * 2 + 1];
  	}

  	// Flush the bit buffer and align the output on a byte boundary
  	function bi_windup() {
  		if (bi_valid > 8) {
  			put_short(bi_buf);
  		} else if (bi_valid > 0) {
  			put_byte(bi_buf & 0xff);
  		}
  		bi_buf = 0;
  		bi_valid = 0;
  	}

  	// Copy a stored block, storing first the length and its
  	// one's complement if requested.
  	function copy_block(buf, // the input data
  		len, // its length
  		header // true if block header must be written
  	) {
  		bi_windup(); // align on byte boundary
  		last_eob_len = 8; // enough lookahead for inflate

  		if (header) {
  			put_short(len);
  			put_short(~len);
  		}

  		that.pending_buf.set(win.subarray(buf, buf + len), that.pending);
  		that.pending += len;
  	}

  	// Send a stored block
  	function _tr_stored_block(buf, // input block
  		stored_len, // length of input block
  		eof // true if this is the last block for a file
  	) {
  		send_bits((STORED_BLOCK << 1) + (eof ? 1 : 0), 3); // send block type
  		copy_block(buf, stored_len, true); // with header
  	}

  	// Determine the best encoding for the current block: dynamic trees, static
  	// trees or store, and output the encoded block to the zip file.
  	function _tr_flush_block(buf, // input block, or NULL if too old
  		stored_len, // length of input block
  		eof // true if this is the last block for a file
  	) {
  		let opt_lenb, static_lenb;// opt_len and static_len in bytes
  		let max_blindex = 0; // index of last bit length code of non zero freq

  		// Build the Huffman trees unless a stored block is forced
  		if (level > 0) {
  			// Construct the literal and distance trees
  			l_desc.build_tree(that);

  			d_desc.build_tree(that);

  			// At this point, opt_len and static_len are the total bit lengths
  			// of
  			// the compressed block data, excluding the tree representations.

  			// Build the bit length tree for the above two trees, and get the
  			// index
  			// in bl_order of the last bit length code to send.
  			max_blindex = build_bl_tree();

  			// Determine the best encoding. Compute first the block length in
  			// bytes
  			opt_lenb = (that.opt_len + 3 + 7) >>> 3;
  			static_lenb = (that.static_len + 3 + 7) >>> 3;

  			if (static_lenb <= opt_lenb)
  				opt_lenb = static_lenb;
  		} else {
  			opt_lenb = static_lenb = stored_len + 5; // force a stored block
  		}

  		if ((stored_len + 4 <= opt_lenb) && buf != -1) {
  			// 4: two words for the lengths
  			// The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
  			// Otherwise we can't have processed more than WSIZE input bytes
  			// since
  			// the last block flush, because compression would have been
  			// successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
  			// transform a block into a stored block.
  			_tr_stored_block(buf, stored_len, eof);
  		} else if (static_lenb == opt_lenb) {
  			send_bits((STATIC_TREES << 1) + (eof ? 1 : 0), 3);
  			compress_block(StaticTree.static_ltree, StaticTree.static_dtree);
  		} else {
  			send_bits((DYN_TREES << 1) + (eof ? 1 : 0), 3);
  			send_all_trees(l_desc.max_code + 1, d_desc.max_code + 1, max_blindex + 1);
  			compress_block(dyn_ltree, dyn_dtree);
  		}

  		// The above check is made mod 2^32, for files larger than 512 MB
  		// and uLong implemented on 32 bits.

  		init_block();

  		if (eof) {
  			bi_windup();
  		}
  	}

  	function flush_block_only(eof) {
  		_tr_flush_block(block_start >= 0 ? block_start : -1, strstart - block_start, eof);
  		block_start = strstart;
  		strm.flush_pending();
  	}

  	// Fill the win when the lookahead becomes insufficient.
  	// Updates strstart and lookahead.
  	//
  	// IN assertion: lookahead < MIN_LOOKAHEAD
  	// OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
  	// At least one byte has been read, or avail_in === 0; reads are
  	// performed for at least two bytes (required for the zip translate_eol
  	// option -- not supported here).
  	function fill_window() {
  		let n, m;
  		let p;
  		let more; // Amount of free space at the end of the win.

  		do {
  			more = (window_size - lookahead - strstart);

  			// Deal with !@#$% 64K limit:
  			if (more === 0 && strstart === 0 && lookahead === 0) {
  				more = w_size;
  			} else if (more == -1) {
  				// Very unlikely, but possible on 16 bit machine if strstart ==
  				// 0
  				// and lookahead == 1 (input done one byte at time)
  				more--;

  				// If the win is almost full and there is insufficient
  				// lookahead,
  				// move the upper half to the lower one to make room in the
  				// upper half.
  			} else if (strstart >= w_size + w_size - MIN_LOOKAHEAD) {
  				win.set(win.subarray(w_size, w_size + w_size), 0);

  				match_start -= w_size;
  				strstart -= w_size; // we now have strstart >= MAX_DIST
  				block_start -= w_size;

  				// Slide the hash table (could be avoided with 32 bit values
  				// at the expense of memory usage). We slide even when level ==
  				// 0
  				// to keep the hash table consistent if we switch back to level
  				// > 0
  				// later. (Using level 0 permanently is not an optimal usage of
  				// zlib, so we don't care about this pathological case.)

  				n = hash_size;
  				p = n;
  				do {
  					m = (head[--p] & 0xffff);
  					head[p] = (m >= w_size ? m - w_size : 0);
  				} while (--n !== 0);

  				n = w_size;
  				p = n;
  				do {
  					m = (prev[--p] & 0xffff);
  					prev[p] = (m >= w_size ? m - w_size : 0);
  					// If n is not on any hash chain, prev[n] is garbage but
  					// its value will never be used.
  				} while (--n !== 0);
  				more += w_size;
  			}

  			if (strm.avail_in === 0)
  				return;

  			// If there was no sliding:
  			// strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
  			// more == window_size - lookahead - strstart
  			// => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
  			// => more >= window_size - 2*WSIZE + 2
  			// In the BIG_MEM or MMAP case (not yet supported),
  			// window_size == input_size + MIN_LOOKAHEAD &&
  			// strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
  			// Otherwise, window_size == 2*WSIZE so more >= 2.
  			// If there was sliding, more >= WSIZE. So in all cases, more >= 2.

  			n = strm.read_buf(win, strstart + lookahead, more);
  			lookahead += n;

  			// Initialize the hash value now that we have some input:
  			if (lookahead >= MIN_MATCH) {
  				ins_h = win[strstart] & 0xff;
  				ins_h = (((ins_h) << hash_shift) ^ (win[strstart + 1] & 0xff)) & hash_mask;
  			}
  			// If the whole input has less than MIN_MATCH bytes, ins_h is
  			// garbage,
  			// but this is not important since only literal bytes will be
  			// emitted.
  		} while (lookahead < MIN_LOOKAHEAD && strm.avail_in !== 0);
  	}

  	// Copy without compression as much as possible from the input stream,
  	// return
  	// the current block state.
  	// This function does not insert new strings in the dictionary since
  	// uncompressible data is probably not useful. This function is used
  	// only for the level=0 compression option.
  	// NOTE: this function should be optimized to avoid extra copying from
  	// win to pending_buf.
  	function deflate_stored(flush) {
  		// Stored blocks are limited to 0xffff bytes, pending_buf is limited
  		// to pending_buf_size, and each stored block has a 5 byte header:

  		let max_block_size = 0xffff;
  		let max_start;

  		if (max_block_size > pending_buf_size - 5) {
  			max_block_size = pending_buf_size - 5;
  		}

  		// Copy as much as possible from input to output:
  		// eslint-disable-next-line no-constant-condition
  		while (true) {
  			// Fill the win as much as possible:
  			if (lookahead <= 1) {
  				fill_window();
  				if (lookahead === 0 && flush == Z_NO_FLUSH$1)
  					return NeedMore;
  				if (lookahead === 0)
  					break; // flush the current block
  			}

  			strstart += lookahead;
  			lookahead = 0;

  			// Emit a stored block if pending_buf will be full:
  			max_start = block_start + max_block_size;
  			if (strstart === 0 || strstart >= max_start) {
  				// strstart === 0 is possible when wraparound on 16-bit machine
  				lookahead = (strstart - max_start);
  				strstart = max_start;

  				flush_block_only(false);
  				if (strm.avail_out === 0)
  					return NeedMore;

  			}

  			// Flush if we may have to slide, otherwise block_start may become
  			// negative and the data will be gone:
  			if (strstart - block_start >= w_size - MIN_LOOKAHEAD) {
  				flush_block_only(false);
  				if (strm.avail_out === 0)
  					return NeedMore;
  			}
  		}

  		flush_block_only(flush == Z_FINISH$1);
  		if (strm.avail_out === 0)
  			return (flush == Z_FINISH$1) ? FinishStarted : NeedMore;

  		return flush == Z_FINISH$1 ? FinishDone : BlockDone;
  	}

  	function longest_match(cur_match) {
  		let chain_length = max_chain_length; // max hash chain length
  		let scan = strstart; // current string
  		let match; // matched string
  		let len; // length of current match
  		let best_len = prev_length; // best match length so far
  		const limit = strstart > (w_size - MIN_LOOKAHEAD) ? strstart - (w_size - MIN_LOOKAHEAD) : 0;
  		let _nice_match = nice_match;

  		// Stop when cur_match becomes <= limit. To simplify the code,
  		// we prevent matches with the string of win index 0.

  		const wmask = w_mask;

  		const strend = strstart + MAX_MATCH;
  		let scan_end1 = win[scan + best_len - 1];
  		let scan_end = win[scan + best_len];

  		// The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of
  		// 16.
  		// It is easy to get rid of this optimization if necessary.

  		// Do not waste too much time if we already have a good match:
  		if (prev_length >= good_match) {
  			chain_length >>= 2;
  		}

  		// Do not look for matches beyond the end of the input. This is
  		// necessary
  		// to make deflate deterministic.
  		if (_nice_match > lookahead)
  			_nice_match = lookahead;

  		do {
  			match = cur_match;

  			// Skip to next match if the match length cannot increase
  			// or if the match length is less than 2:
  			if (win[match + best_len] != scan_end || win[match + best_len - 1] != scan_end1 || win[match] != win[scan]
  				|| win[++match] != win[scan + 1])
  				continue;

  			// The check at best_len-1 can be removed because it will be made
  			// again later. (This heuristic is not always a win.)
  			// It is not necessary to compare scan[2] and match[2] since they
  			// are always equal when the other bytes match, given that
  			// the hash keys are equal and that HASH_BITS >= 8.
  			scan += 2;
  			match++;

  			// We check for insufficient lookahead only every 8th comparison;
  			// the 256th check will be made at strstart+258.
  			// eslint-disable-next-line no-empty
  			do {
  				// empty block
  			} while (win[++scan] == win[++match] && win[++scan] == win[++match] && win[++scan] == win[++match]
  			&& win[++scan] == win[++match] && win[++scan] == win[++match] && win[++scan] == win[++match]
  			&& win[++scan] == win[++match] && win[++scan] == win[++match] && scan < strend);

  			len = MAX_MATCH - (strend - scan);
  			scan = strend - MAX_MATCH;

  			if (len > best_len) {
  				match_start = cur_match;
  				best_len = len;
  				if (len >= _nice_match)
  					break;
  				scan_end1 = win[scan + best_len - 1];
  				scan_end = win[scan + best_len];
  			}

  		} while ((cur_match = (prev[cur_match & wmask] & 0xffff)) > limit && --chain_length !== 0);

  		if (best_len <= lookahead)
  			return best_len;
  		return lookahead;
  	}

  	// Compress as much as possible from the input stream, return the current
  	// block state.
  	// This function does not perform lazy evaluation of matches and inserts
  	// new strings in the dictionary only for unmatched strings or for short
  	// matches. It is used only for the fast compression options.
  	function deflate_fast(flush) {
  		// short hash_head = 0; // head of the hash chain
  		let hash_head = 0; // head of the hash chain
  		let bflush; // set if current block must be flushed

  		// eslint-disable-next-line no-constant-condition
  		while (true) {
  			// Make sure that we always have enough lookahead, except
  			// at the end of the input file. We need MAX_MATCH bytes
  			// for the next match, plus MIN_MATCH bytes to insert the
  			// string following the next match.
  			if (lookahead < MIN_LOOKAHEAD) {
  				fill_window();
  				if (lookahead < MIN_LOOKAHEAD && flush == Z_NO_FLUSH$1) {
  					return NeedMore;
  				}
  				if (lookahead === 0)
  					break; // flush the current block
  			}

  			// Insert the string win[strstart .. strstart+2] in the
  			// dictionary, and set hash_head to the head of the hash chain:
  			if (lookahead >= MIN_MATCH) {
  				ins_h = (((ins_h) << hash_shift) ^ (win[(strstart) + (MIN_MATCH - 1)] & 0xff)) & hash_mask;

  				// prev[strstart&w_mask]=hash_head=head[ins_h];
  				hash_head = (head[ins_h] & 0xffff);
  				prev[strstart & w_mask] = head[ins_h];
  				head[ins_h] = strstart;
  			}

  			// Find the longest match, discarding those <= prev_length.
  			// At this point we have always match_length < MIN_MATCH

  			if (hash_head !== 0 && ((strstart - hash_head) & 0xffff) <= w_size - MIN_LOOKAHEAD) {
  				// To simplify the code, we prevent matches with the string
  				// of win index 0 (in particular we have to avoid a match
  				// of the string with itself at the start of the input file).
  				if (strategy != Z_HUFFMAN_ONLY) {
  					match_length = longest_match(hash_head);
  				}
  				// longest_match() sets match_start
  			}
  			if (match_length >= MIN_MATCH) {
  				// check_match(strstart, match_start, match_length);

  				bflush = _tr_tally(strstart - match_start, match_length - MIN_MATCH);

  				lookahead -= match_length;

  				// Insert new strings in the hash table only if the match length
  				// is not too large. This saves time but degrades compression.
  				if (match_length <= max_lazy_match && lookahead >= MIN_MATCH) {
  					match_length--; // string at strstart already in hash table
  					do {
  						strstart++;

  						ins_h = ((ins_h << hash_shift) ^ (win[(strstart) + (MIN_MATCH - 1)] & 0xff)) & hash_mask;
  						// prev[strstart&w_mask]=hash_head=head[ins_h];
  						hash_head = (head[ins_h] & 0xffff);
  						prev[strstart & w_mask] = head[ins_h];
  						head[ins_h] = strstart;

  						// strstart never exceeds WSIZE-MAX_MATCH, so there are
  						// always MIN_MATCH bytes ahead.
  					} while (--match_length !== 0);
  					strstart++;
  				} else {
  					strstart += match_length;
  					match_length = 0;
  					ins_h = win[strstart] & 0xff;

  					ins_h = (((ins_h) << hash_shift) ^ (win[strstart + 1] & 0xff)) & hash_mask;
  					// If lookahead < MIN_MATCH, ins_h is garbage, but it does
  					// not
  					// matter since it will be recomputed at next deflate call.
  				}
  			} else {
  				// No match, output a literal byte

  				bflush = _tr_tally(0, win[strstart] & 0xff);
  				lookahead--;
  				strstart++;
  			}
  			if (bflush) {

  				flush_block_only(false);
  				if (strm.avail_out === 0)
  					return NeedMore;
  			}
  		}

  		flush_block_only(flush == Z_FINISH$1);
  		if (strm.avail_out === 0) {
  			if (flush == Z_FINISH$1)
  				return FinishStarted;
  			else
  				return NeedMore;
  		}
  		return flush == Z_FINISH$1 ? FinishDone : BlockDone;
  	}

  	// Same as above, but achieves better compression. We use a lazy
  	// evaluation for matches: a match is finally adopted only if there is
  	// no better match at the next win position.
  	function deflate_slow(flush) {
  		// short hash_head = 0; // head of hash chain
  		let hash_head = 0; // head of hash chain
  		let bflush; // set if current block must be flushed
  		let max_insert;

  		// Process the input block.
  		// eslint-disable-next-line no-constant-condition
  		while (true) {
  			// Make sure that we always have enough lookahead, except
  			// at the end of the input file. We need MAX_MATCH bytes
  			// for the next match, plus MIN_MATCH bytes to insert the
  			// string following the next match.

  			if (lookahead < MIN_LOOKAHEAD) {
  				fill_window();
  				if (lookahead < MIN_LOOKAHEAD && flush == Z_NO_FLUSH$1) {
  					return NeedMore;
  				}
  				if (lookahead === 0)
  					break; // flush the current block
  			}

  			// Insert the string win[strstart .. strstart+2] in the
  			// dictionary, and set hash_head to the head of the hash chain:

  			if (lookahead >= MIN_MATCH) {
  				ins_h = (((ins_h) << hash_shift) ^ (win[(strstart) + (MIN_MATCH - 1)] & 0xff)) & hash_mask;
  				// prev[strstart&w_mask]=hash_head=head[ins_h];
  				hash_head = (head[ins_h] & 0xffff);
  				prev[strstart & w_mask] = head[ins_h];
  				head[ins_h] = strstart;
  			}

  			// Find the longest match, discarding those <= prev_length.
  			prev_length = match_length;
  			prev_match = match_start;
  			match_length = MIN_MATCH - 1;

  			if (hash_head !== 0 && prev_length < max_lazy_match && ((strstart - hash_head) & 0xffff) <= w_size - MIN_LOOKAHEAD) {
  				// To simplify the code, we prevent matches with the string
  				// of win index 0 (in particular we have to avoid a match
  				// of the string with itself at the start of the input file).

  				if (strategy != Z_HUFFMAN_ONLY) {
  					match_length = longest_match(hash_head);
  				}
  				// longest_match() sets match_start

  				if (match_length <= 5 && (strategy == Z_FILTERED || (match_length == MIN_MATCH && strstart - match_start > 4096))) {

  					// If prev_match is also MIN_MATCH, match_start is garbage
  					// but we will ignore the current match anyway.
  					match_length = MIN_MATCH - 1;
  				}
  			}

  			// If there was a match at the previous step and the current
  			// match is not better, output the previous match:
  			if (prev_length >= MIN_MATCH && match_length <= prev_length) {
  				max_insert = strstart + lookahead - MIN_MATCH;
  				// Do not insert strings in hash table beyond this.

  				// check_match(strstart-1, prev_match, prev_length);

  				bflush = _tr_tally(strstart - 1 - prev_match, prev_length - MIN_MATCH);

  				// Insert in hash table all strings up to the end of the match.
  				// strstart-1 and strstart are already inserted. If there is not
  				// enough lookahead, the last two strings are not inserted in
  				// the hash table.
  				lookahead -= prev_length - 1;
  				prev_length -= 2;
  				do {
  					if (++strstart <= max_insert) {
  						ins_h = (((ins_h) << hash_shift) ^ (win[(strstart) + (MIN_MATCH - 1)] & 0xff)) & hash_mask;
  						// prev[strstart&w_mask]=hash_head=head[ins_h];
  						hash_head = (head[ins_h] & 0xffff);
  						prev[strstart & w_mask] = head[ins_h];
  						head[ins_h] = strstart;
  					}
  				} while (--prev_length !== 0);
  				match_available = 0;
  				match_length = MIN_MATCH - 1;
  				strstart++;

  				if (bflush) {
  					flush_block_only(false);
  					if (strm.avail_out === 0)
  						return NeedMore;
  				}
  			} else if (match_available !== 0) {

  				// If there was no match at the previous position, output a
  				// single literal. If there was a match but the current match
  				// is longer, truncate the previous match to a single literal.

  				bflush = _tr_tally(0, win[strstart - 1] & 0xff);

  				if (bflush) {
  					flush_block_only(false);
  				}
  				strstart++;
  				lookahead--;
  				if (strm.avail_out === 0)
  					return NeedMore;
  			} else {
  				// There is no previous match to compare with, wait for
  				// the next step to decide.

  				match_available = 1;
  				strstart++;
  				lookahead--;
  			}
  		}

  		if (match_available !== 0) {
  			bflush = _tr_tally(0, win[strstart - 1] & 0xff);
  			match_available = 0;
  		}
  		flush_block_only(flush == Z_FINISH$1);

  		if (strm.avail_out === 0) {
  			if (flush == Z_FINISH$1)
  				return FinishStarted;
  			else
  				return NeedMore;
  		}

  		return flush == Z_FINISH$1 ? FinishDone : BlockDone;
  	}

  	function deflateReset(strm) {
  		strm.total_in = strm.total_out = 0;
  		strm.msg = null; //

  		that.pending = 0;
  		that.pending_out = 0;

  		status = BUSY_STATE;

  		last_flush = Z_NO_FLUSH$1;

  		tr_init();
  		lm_init();
  		return Z_OK$1;
  	}

  	that.deflateInit = function (strm, _level, bits, _method, memLevel, _strategy) {
  		if (!_method)
  			_method = Z_DEFLATED$1;
  		if (!memLevel)
  			memLevel = DEF_MEM_LEVEL;
  		if (!_strategy)
  			_strategy = Z_DEFAULT_STRATEGY;

  		// byte[] my_version=ZLIB_VERSION;

  		//
  		// if (!version || version[0] != my_version[0]
  		// || stream_size != sizeof(z_stream)) {
  		// return Z_VERSION_ERROR;
  		// }

  		strm.msg = null;

  		if (_level == Z_DEFAULT_COMPRESSION)
  			_level = 6;

  		if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || _method != Z_DEFLATED$1 || bits < 9 || bits > 15 || _level < 0 || _level > 9 || _strategy < 0
  			|| _strategy > Z_HUFFMAN_ONLY) {
  			return Z_STREAM_ERROR$1;
  		}

  		strm.dstate = that;

  		w_bits = bits;
  		w_size = 1 << w_bits;
  		w_mask = w_size - 1;

  		hash_bits = memLevel + 7;
  		hash_size = 1 << hash_bits;
  		hash_mask = hash_size - 1;
  		hash_shift = Math.floor((hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  		win = new Uint8Array(w_size * 2);
  		prev = [];
  		head = [];

  		lit_bufsize = 1 << (memLevel + 6); // 16K elements by default

  		that.pending_buf = new Uint8Array(lit_bufsize * 4);
  		pending_buf_size = lit_bufsize * 4;

  		that.dist_buf = new Uint16Array(lit_bufsize);
  		that.lc_buf = new Uint8Array(lit_bufsize);

  		level = _level;

  		strategy = _strategy;

  		return deflateReset(strm);
  	};

  	that.deflateEnd = function () {
  		if (status != INIT_STATE && status != BUSY_STATE && status != FINISH_STATE) {
  			return Z_STREAM_ERROR$1;
  		}
  		// Deallocate in reverse order of allocations:
  		that.lc_buf = null;
  		that.dist_buf = null;
  		that.pending_buf = null;
  		head = null;
  		prev = null;
  		win = null;
  		// free
  		that.dstate = null;
  		return status == BUSY_STATE ? Z_DATA_ERROR$1 : Z_OK$1;
  	};

  	that.deflateParams = function (strm, _level, _strategy) {
  		let err = Z_OK$1;

  		if (_level == Z_DEFAULT_COMPRESSION) {
  			_level = 6;
  		}
  		if (_level < 0 || _level > 9 || _strategy < 0 || _strategy > Z_HUFFMAN_ONLY) {
  			return Z_STREAM_ERROR$1;
  		}

  		if (config_table[level].func != config_table[_level].func && strm.total_in !== 0) {
  			// Flush the last buffer:
  			err = strm.deflate(Z_PARTIAL_FLUSH);
  		}

  		if (level != _level) {
  			level = _level;
  			max_lazy_match = config_table[level].max_lazy;
  			good_match = config_table[level].good_length;
  			nice_match = config_table[level].nice_length;
  			max_chain_length = config_table[level].max_chain;
  		}
  		strategy = _strategy;
  		return err;
  	};

  	that.deflateSetDictionary = function (_strm, dictionary, dictLength) {
  		let length = dictLength;
  		let n, index = 0;

  		if (!dictionary || status != INIT_STATE)
  			return Z_STREAM_ERROR$1;

  		if (length < MIN_MATCH)
  			return Z_OK$1;
  		if (length > w_size - MIN_LOOKAHEAD) {
  			length = w_size - MIN_LOOKAHEAD;
  			index = dictLength - length; // use the tail of the dictionary
  		}
  		win.set(dictionary.subarray(index, index + length), 0);

  		strstart = length;
  		block_start = length;

  		// Insert all strings in the hash table (except for the last two bytes).
  		// s->lookahead stays null, so s->ins_h will be recomputed at the next
  		// call of fill_window.

  		ins_h = win[0] & 0xff;
  		ins_h = (((ins_h) << hash_shift) ^ (win[1] & 0xff)) & hash_mask;

  		for (n = 0; n <= length - MIN_MATCH; n++) {
  			ins_h = (((ins_h) << hash_shift) ^ (win[(n) + (MIN_MATCH - 1)] & 0xff)) & hash_mask;
  			prev[n & w_mask] = head[ins_h];
  			head[ins_h] = n;
  		}
  		return Z_OK$1;
  	};

  	that.deflate = function (_strm, flush) {
  		let i, header, level_flags, old_flush, bstate;

  		if (flush > Z_FINISH$1 || flush < 0) {
  			return Z_STREAM_ERROR$1;
  		}

  		if (!_strm.next_out || (!_strm.next_in && _strm.avail_in !== 0) || (status == FINISH_STATE && flush != Z_FINISH$1)) {
  			_strm.msg = z_errmsg[Z_NEED_DICT$1 - (Z_STREAM_ERROR$1)];
  			return Z_STREAM_ERROR$1;
  		}
  		if (_strm.avail_out === 0) {
  			_strm.msg = z_errmsg[Z_NEED_DICT$1 - (Z_BUF_ERROR$1)];
  			return Z_BUF_ERROR$1;
  		}

  		strm = _strm; // just in case
  		old_flush = last_flush;
  		last_flush = flush;

  		// Write the zlib header
  		if (status == INIT_STATE) {
  			header = (Z_DEFLATED$1 + ((w_bits - 8) << 4)) << 8;
  			level_flags = ((level - 1) & 0xff) >> 1;

  			if (level_flags > 3)
  				level_flags = 3;
  			header |= (level_flags << 6);
  			if (strstart !== 0)
  				header |= PRESET_DICT$1;
  			header += 31 - (header % 31);

  			status = BUSY_STATE;
  			putShortMSB(header);
  		}

  		// Flush as much pending output as possible
  		if (that.pending !== 0) {
  			strm.flush_pending();
  			if (strm.avail_out === 0) {
  				// console.log(" avail_out==0");
  				// Since avail_out is 0, deflate will be called again with
  				// more output space, but possibly with both pending and
  				// avail_in equal to zero. There won't be anything to do,
  				// but this is not an error situation so make sure we
  				// return OK instead of BUF_ERROR at next call of deflate:
  				last_flush = -1;
  				return Z_OK$1;
  			}

  			// Make sure there is something to do and avoid duplicate
  			// consecutive
  			// flushes. For repeated and useless calls with Z_FINISH, we keep
  			// returning Z_STREAM_END instead of Z_BUFF_ERROR.
  		} else if (strm.avail_in === 0 && flush <= old_flush && flush != Z_FINISH$1) {
  			strm.msg = z_errmsg[Z_NEED_DICT$1 - (Z_BUF_ERROR$1)];
  			return Z_BUF_ERROR$1;
  		}

  		// User must not provide more input after the first FINISH:
  		if (status == FINISH_STATE && strm.avail_in !== 0) {
  			_strm.msg = z_errmsg[Z_NEED_DICT$1 - (Z_BUF_ERROR$1)];
  			return Z_BUF_ERROR$1;
  		}

  		// Start a new block or continue the current one.
  		if (strm.avail_in !== 0 || lookahead !== 0 || (flush != Z_NO_FLUSH$1 && status != FINISH_STATE)) {
  			bstate = -1;
  			switch (config_table[level].func) {
  				case STORED$1:
  					bstate = deflate_stored(flush);
  					break;
  				case FAST:
  					bstate = deflate_fast(flush);
  					break;
  				case SLOW:
  					bstate = deflate_slow(flush);
  					break;
  			}

  			if (bstate == FinishStarted || bstate == FinishDone) {
  				status = FINISH_STATE;
  			}
  			if (bstate == NeedMore || bstate == FinishStarted) {
  				if (strm.avail_out === 0) {
  					last_flush = -1; // avoid BUF_ERROR next call, see above
  				}
  				return Z_OK$1;
  				// If flush != Z_NO_FLUSH && avail_out === 0, the next call
  				// of deflate should use the same flush parameter to make sure
  				// that the flush is complete. So we don't have to output an
  				// empty block here, this will be done at next call. This also
  				// ensures that for a very small output buffer, we emit at most
  				// one empty block.
  			}

  			if (bstate == BlockDone) {
  				if (flush == Z_PARTIAL_FLUSH) {
  					_tr_align();
  				} else { // FULL_FLUSH or SYNC_FLUSH
  					_tr_stored_block(0, 0, false);
  					// For a full flush, this empty block will be recognized
  					// as a special marker by inflate_sync().
  					if (flush == Z_FULL_FLUSH) {
  						// state.head[s.hash_size-1]=0;
  						for (i = 0; i < hash_size/*-1*/; i++)
  							// forget history
  							head[i] = 0;
  					}
  				}
  				strm.flush_pending();
  				if (strm.avail_out === 0) {
  					last_flush = -1; // avoid BUF_ERROR at next call, see above
  					return Z_OK$1;
  				}
  			}
  		}

  		if (flush != Z_FINISH$1)
  			return Z_OK$1;
  		return Z_STREAM_END$1;
  	};
  }

  // ZStream

  function ZStream$1() {
  	const that = this;
  	that.next_in_index = 0;
  	that.next_out_index = 0;
  	// that.next_in; // next input byte
  	that.avail_in = 0; // number of bytes available at next_in
  	that.total_in = 0; // total nb of input bytes read so far
  	// that.next_out; // next output byte should be put there
  	that.avail_out = 0; // remaining free space at next_out
  	that.total_out = 0; // total nb of bytes output so far
  	// that.msg;
  	// that.dstate;
  }

  ZStream$1.prototype = {
  	deflateInit(level, bits) {
  		const that = this;
  		that.dstate = new Deflate();
  		if (!bits)
  			bits = MAX_BITS$1;
  		return that.dstate.deflateInit(that, level, bits);
  	},

  	deflate(flush) {
  		const that = this;
  		if (!that.dstate) {
  			return Z_STREAM_ERROR$1;
  		}
  		return that.dstate.deflate(that, flush);
  	},

  	deflateEnd() {
  		const that = this;
  		if (!that.dstate)
  			return Z_STREAM_ERROR$1;
  		const ret = that.dstate.deflateEnd();
  		that.dstate = null;
  		return ret;
  	},

  	deflateParams(level, strategy) {
  		const that = this;
  		if (!that.dstate)
  			return Z_STREAM_ERROR$1;
  		return that.dstate.deflateParams(that, level, strategy);
  	},

  	deflateSetDictionary(dictionary, dictLength) {
  		const that = this;
  		if (!that.dstate)
  			return Z_STREAM_ERROR$1;
  		return that.dstate.deflateSetDictionary(that, dictionary, dictLength);
  	},

  	// Read a new buffer from the current input stream, update the
  	// total number of bytes read. All deflate() input goes through
  	// this function so some applications may wish to modify it to avoid
  	// allocating a large strm->next_in buffer and copying from it.
  	// (See also flush_pending()).
  	read_buf(buf, start, size) {
  		const that = this;
  		let len = that.avail_in;
  		if (len > size)
  			len = size;
  		if (len === 0)
  			return 0;
  		that.avail_in -= len;
  		buf.set(that.next_in.subarray(that.next_in_index, that.next_in_index + len), start);
  		that.next_in_index += len;
  		that.total_in += len;
  		return len;
  	},

  	// Flush as much pending output as possible. All deflate() output goes
  	// through this function so some applications may wish to modify it
  	// to avoid allocating a large strm->next_out buffer and copying into it.
  	// (See also read_buf()).
  	flush_pending() {
  		const that = this;
  		let len = that.dstate.pending;

  		if (len > that.avail_out)
  			len = that.avail_out;
  		if (len === 0)
  			return;

  		// if (that.dstate.pending_buf.length <= that.dstate.pending_out || that.next_out.length <= that.next_out_index
  		// || that.dstate.pending_buf.length < (that.dstate.pending_out + len) || that.next_out.length < (that.next_out_index +
  		// len)) {
  		// console.log(that.dstate.pending_buf.length + ", " + that.dstate.pending_out + ", " + that.next_out.length + ", " +
  		// that.next_out_index + ", " + len);
  		// console.log("avail_out=" + that.avail_out);
  		// }

  		that.next_out.set(that.dstate.pending_buf.subarray(that.dstate.pending_out, that.dstate.pending_out + len), that.next_out_index);

  		that.next_out_index += len;
  		that.dstate.pending_out += len;
  		that.total_out += len;
  		that.avail_out -= len;
  		that.dstate.pending -= len;
  		if (that.dstate.pending === 0) {
  			that.dstate.pending_out = 0;
  		}
  	}
  };

  // Deflate

  function ZipDeflate(options) {
  	const that = this;
  	const z = new ZStream$1();
  	const bufsize = getMaximumCompressedSize$1(options && options.chunkSize ? options.chunkSize : 64 * 1024);
  	const flush = Z_NO_FLUSH$1;
  	const buf = new Uint8Array(bufsize);
  	let level = options ? options.level : Z_DEFAULT_COMPRESSION;
  	if (typeof level == "undefined")
  		level = Z_DEFAULT_COMPRESSION;
  	z.deflateInit(level);
  	z.next_out = buf;

  	that.append = function (data, onprogress) {
  		let err, array, lastIndex = 0, bufferIndex = 0, bufferSize = 0;
  		const buffers = [];
  		if (!data.length)
  			return;
  		z.next_in_index = 0;
  		z.next_in = data;
  		z.avail_in = data.length;
  		do {
  			z.next_out_index = 0;
  			z.avail_out = bufsize;
  			err = z.deflate(flush);
  			if (err != Z_OK$1)
  				throw new Error("deflating: " + z.msg);
  			if (z.next_out_index)
  				if (z.next_out_index == bufsize)
  					buffers.push(new Uint8Array(buf));
  				else
  					buffers.push(buf.slice(0, z.next_out_index));
  			bufferSize += z.next_out_index;
  			if (onprogress && z.next_in_index > 0 && z.next_in_index != lastIndex) {
  				onprogress(z.next_in_index);
  				lastIndex = z.next_in_index;
  			}
  		} while (z.avail_in > 0 || z.avail_out === 0);
  		if (buffers.length > 1) {
  			array = new Uint8Array(bufferSize);
  			buffers.forEach(function (chunk) {
  				array.set(chunk, bufferIndex);
  				bufferIndex += chunk.length;
  			});
  		} else {
  			array = buffers[0] || new Uint8Array();
  		}
  		return array;
  	};
  	that.flush = function () {
  		let err, array, bufferIndex = 0, bufferSize = 0;
  		const buffers = [];
  		do {
  			z.next_out_index = 0;
  			z.avail_out = bufsize;
  			err = z.deflate(Z_FINISH$1);
  			if (err != Z_STREAM_END$1 && err != Z_OK$1)
  				throw new Error("deflating: " + z.msg);
  			if (bufsize - z.avail_out > 0)
  				buffers.push(buf.slice(0, z.next_out_index));
  			bufferSize += z.next_out_index;
  		} while (z.avail_in > 0 || z.avail_out === 0);
  		z.deflateEnd();
  		array = new Uint8Array(bufferSize);
  		buffers.forEach(function (chunk) {
  			array.set(chunk, bufferIndex);
  			bufferIndex += chunk.length;
  		});
  		return array;
  	};
  }

  function getMaximumCompressedSize$1(uncompressedSize) {
  	return uncompressedSize + (5 * (Math.floor(uncompressedSize / 16383) + 1));
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  /*
   * This program is based on JZlib 1.0.2 ymnk, JCraft,Inc.
   * JZlib is based on zlib-1.1.3, so all credit should go authors
   * Jean-loup Gailly(jloup@gzip.org) and Mark Adler(madler@alumni.caltech.edu)
   * and contributors of zlib.
   */

  // deno-lint-ignore-file no-this-alias prefer-const

  // Global

  const MAX_BITS = 15;

  const Z_OK = 0;
  const Z_STREAM_END = 1;
  const Z_NEED_DICT = 2;
  const Z_STREAM_ERROR = -2;
  const Z_DATA_ERROR = -3;
  const Z_MEM_ERROR = -4;
  const Z_BUF_ERROR = -5;

  const inflate_mask = [0x00000000, 0x00000001, 0x00000003, 0x00000007, 0x0000000f, 0x0000001f, 0x0000003f, 0x0000007f, 0x000000ff, 0x000001ff, 0x000003ff,
  	0x000007ff, 0x00000fff, 0x00001fff, 0x00003fff, 0x00007fff, 0x0000ffff];

  const MANY = 1440;

  // JZlib version : "1.0.2"
  const Z_NO_FLUSH = 0;
  const Z_FINISH = 4;

  // InfTree
  const fixed_bl = 9;
  const fixed_bd = 5;

  const fixed_tl = [96, 7, 256, 0, 8, 80, 0, 8, 16, 84, 8, 115, 82, 7, 31, 0, 8, 112, 0, 8, 48, 0, 9, 192, 80, 7, 10, 0, 8, 96, 0, 8, 32, 0, 9, 160, 0, 8, 0,
  	0, 8, 128, 0, 8, 64, 0, 9, 224, 80, 7, 6, 0, 8, 88, 0, 8, 24, 0, 9, 144, 83, 7, 59, 0, 8, 120, 0, 8, 56, 0, 9, 208, 81, 7, 17, 0, 8, 104, 0, 8, 40,
  	0, 9, 176, 0, 8, 8, 0, 8, 136, 0, 8, 72, 0, 9, 240, 80, 7, 4, 0, 8, 84, 0, 8, 20, 85, 8, 227, 83, 7, 43, 0, 8, 116, 0, 8, 52, 0, 9, 200, 81, 7, 13,
  	0, 8, 100, 0, 8, 36, 0, 9, 168, 0, 8, 4, 0, 8, 132, 0, 8, 68, 0, 9, 232, 80, 7, 8, 0, 8, 92, 0, 8, 28, 0, 9, 152, 84, 7, 83, 0, 8, 124, 0, 8, 60,
  	0, 9, 216, 82, 7, 23, 0, 8, 108, 0, 8, 44, 0, 9, 184, 0, 8, 12, 0, 8, 140, 0, 8, 76, 0, 9, 248, 80, 7, 3, 0, 8, 82, 0, 8, 18, 85, 8, 163, 83, 7,
  	35, 0, 8, 114, 0, 8, 50, 0, 9, 196, 81, 7, 11, 0, 8, 98, 0, 8, 34, 0, 9, 164, 0, 8, 2, 0, 8, 130, 0, 8, 66, 0, 9, 228, 80, 7, 7, 0, 8, 90, 0, 8,
  	26, 0, 9, 148, 84, 7, 67, 0, 8, 122, 0, 8, 58, 0, 9, 212, 82, 7, 19, 0, 8, 106, 0, 8, 42, 0, 9, 180, 0, 8, 10, 0, 8, 138, 0, 8, 74, 0, 9, 244, 80,
  	7, 5, 0, 8, 86, 0, 8, 22, 192, 8, 0, 83, 7, 51, 0, 8, 118, 0, 8, 54, 0, 9, 204, 81, 7, 15, 0, 8, 102, 0, 8, 38, 0, 9, 172, 0, 8, 6, 0, 8, 134, 0,
  	8, 70, 0, 9, 236, 80, 7, 9, 0, 8, 94, 0, 8, 30, 0, 9, 156, 84, 7, 99, 0, 8, 126, 0, 8, 62, 0, 9, 220, 82, 7, 27, 0, 8, 110, 0, 8, 46, 0, 9, 188, 0,
  	8, 14, 0, 8, 142, 0, 8, 78, 0, 9, 252, 96, 7, 256, 0, 8, 81, 0, 8, 17, 85, 8, 131, 82, 7, 31, 0, 8, 113, 0, 8, 49, 0, 9, 194, 80, 7, 10, 0, 8, 97,
  	0, 8, 33, 0, 9, 162, 0, 8, 1, 0, 8, 129, 0, 8, 65, 0, 9, 226, 80, 7, 6, 0, 8, 89, 0, 8, 25, 0, 9, 146, 83, 7, 59, 0, 8, 121, 0, 8, 57, 0, 9, 210,
  	81, 7, 17, 0, 8, 105, 0, 8, 41, 0, 9, 178, 0, 8, 9, 0, 8, 137, 0, 8, 73, 0, 9, 242, 80, 7, 4, 0, 8, 85, 0, 8, 21, 80, 8, 258, 83, 7, 43, 0, 8, 117,
  	0, 8, 53, 0, 9, 202, 81, 7, 13, 0, 8, 101, 0, 8, 37, 0, 9, 170, 0, 8, 5, 0, 8, 133, 0, 8, 69, 0, 9, 234, 80, 7, 8, 0, 8, 93, 0, 8, 29, 0, 9, 154,
  	84, 7, 83, 0, 8, 125, 0, 8, 61, 0, 9, 218, 82, 7, 23, 0, 8, 109, 0, 8, 45, 0, 9, 186, 0, 8, 13, 0, 8, 141, 0, 8, 77, 0, 9, 250, 80, 7, 3, 0, 8, 83,
  	0, 8, 19, 85, 8, 195, 83, 7, 35, 0, 8, 115, 0, 8, 51, 0, 9, 198, 81, 7, 11, 0, 8, 99, 0, 8, 35, 0, 9, 166, 0, 8, 3, 0, 8, 131, 0, 8, 67, 0, 9, 230,
  	80, 7, 7, 0, 8, 91, 0, 8, 27, 0, 9, 150, 84, 7, 67, 0, 8, 123, 0, 8, 59, 0, 9, 214, 82, 7, 19, 0, 8, 107, 0, 8, 43, 0, 9, 182, 0, 8, 11, 0, 8, 139,
  	0, 8, 75, 0, 9, 246, 80, 7, 5, 0, 8, 87, 0, 8, 23, 192, 8, 0, 83, 7, 51, 0, 8, 119, 0, 8, 55, 0, 9, 206, 81, 7, 15, 0, 8, 103, 0, 8, 39, 0, 9, 174,
  	0, 8, 7, 0, 8, 135, 0, 8, 71, 0, 9, 238, 80, 7, 9, 0, 8, 95, 0, 8, 31, 0, 9, 158, 84, 7, 99, 0, 8, 127, 0, 8, 63, 0, 9, 222, 82, 7, 27, 0, 8, 111,
  	0, 8, 47, 0, 9, 190, 0, 8, 15, 0, 8, 143, 0, 8, 79, 0, 9, 254, 96, 7, 256, 0, 8, 80, 0, 8, 16, 84, 8, 115, 82, 7, 31, 0, 8, 112, 0, 8, 48, 0, 9,
  	193, 80, 7, 10, 0, 8, 96, 0, 8, 32, 0, 9, 161, 0, 8, 0, 0, 8, 128, 0, 8, 64, 0, 9, 225, 80, 7, 6, 0, 8, 88, 0, 8, 24, 0, 9, 145, 83, 7, 59, 0, 8,
  	120, 0, 8, 56, 0, 9, 209, 81, 7, 17, 0, 8, 104, 0, 8, 40, 0, 9, 177, 0, 8, 8, 0, 8, 136, 0, 8, 72, 0, 9, 241, 80, 7, 4, 0, 8, 84, 0, 8, 20, 85, 8,
  	227, 83, 7, 43, 0, 8, 116, 0, 8, 52, 0, 9, 201, 81, 7, 13, 0, 8, 100, 0, 8, 36, 0, 9, 169, 0, 8, 4, 0, 8, 132, 0, 8, 68, 0, 9, 233, 80, 7, 8, 0, 8,
  	92, 0, 8, 28, 0, 9, 153, 84, 7, 83, 0, 8, 124, 0, 8, 60, 0, 9, 217, 82, 7, 23, 0, 8, 108, 0, 8, 44, 0, 9, 185, 0, 8, 12, 0, 8, 140, 0, 8, 76, 0, 9,
  	249, 80, 7, 3, 0, 8, 82, 0, 8, 18, 85, 8, 163, 83, 7, 35, 0, 8, 114, 0, 8, 50, 0, 9, 197, 81, 7, 11, 0, 8, 98, 0, 8, 34, 0, 9, 165, 0, 8, 2, 0, 8,
  	130, 0, 8, 66, 0, 9, 229, 80, 7, 7, 0, 8, 90, 0, 8, 26, 0, 9, 149, 84, 7, 67, 0, 8, 122, 0, 8, 58, 0, 9, 213, 82, 7, 19, 0, 8, 106, 0, 8, 42, 0, 9,
  	181, 0, 8, 10, 0, 8, 138, 0, 8, 74, 0, 9, 245, 80, 7, 5, 0, 8, 86, 0, 8, 22, 192, 8, 0, 83, 7, 51, 0, 8, 118, 0, 8, 54, 0, 9, 205, 81, 7, 15, 0, 8,
  	102, 0, 8, 38, 0, 9, 173, 0, 8, 6, 0, 8, 134, 0, 8, 70, 0, 9, 237, 80, 7, 9, 0, 8, 94, 0, 8, 30, 0, 9, 157, 84, 7, 99, 0, 8, 126, 0, 8, 62, 0, 9,
  	221, 82, 7, 27, 0, 8, 110, 0, 8, 46, 0, 9, 189, 0, 8, 14, 0, 8, 142, 0, 8, 78, 0, 9, 253, 96, 7, 256, 0, 8, 81, 0, 8, 17, 85, 8, 131, 82, 7, 31, 0,
  	8, 113, 0, 8, 49, 0, 9, 195, 80, 7, 10, 0, 8, 97, 0, 8, 33, 0, 9, 163, 0, 8, 1, 0, 8, 129, 0, 8, 65, 0, 9, 227, 80, 7, 6, 0, 8, 89, 0, 8, 25, 0, 9,
  	147, 83, 7, 59, 0, 8, 121, 0, 8, 57, 0, 9, 211, 81, 7, 17, 0, 8, 105, 0, 8, 41, 0, 9, 179, 0, 8, 9, 0, 8, 137, 0, 8, 73, 0, 9, 243, 80, 7, 4, 0, 8,
  	85, 0, 8, 21, 80, 8, 258, 83, 7, 43, 0, 8, 117, 0, 8, 53, 0, 9, 203, 81, 7, 13, 0, 8, 101, 0, 8, 37, 0, 9, 171, 0, 8, 5, 0, 8, 133, 0, 8, 69, 0, 9,
  	235, 80, 7, 8, 0, 8, 93, 0, 8, 29, 0, 9, 155, 84, 7, 83, 0, 8, 125, 0, 8, 61, 0, 9, 219, 82, 7, 23, 0, 8, 109, 0, 8, 45, 0, 9, 187, 0, 8, 13, 0, 8,
  	141, 0, 8, 77, 0, 9, 251, 80, 7, 3, 0, 8, 83, 0, 8, 19, 85, 8, 195, 83, 7, 35, 0, 8, 115, 0, 8, 51, 0, 9, 199, 81, 7, 11, 0, 8, 99, 0, 8, 35, 0, 9,
  	167, 0, 8, 3, 0, 8, 131, 0, 8, 67, 0, 9, 231, 80, 7, 7, 0, 8, 91, 0, 8, 27, 0, 9, 151, 84, 7, 67, 0, 8, 123, 0, 8, 59, 0, 9, 215, 82, 7, 19, 0, 8,
  	107, 0, 8, 43, 0, 9, 183, 0, 8, 11, 0, 8, 139, 0, 8, 75, 0, 9, 247, 80, 7, 5, 0, 8, 87, 0, 8, 23, 192, 8, 0, 83, 7, 51, 0, 8, 119, 0, 8, 55, 0, 9,
  	207, 81, 7, 15, 0, 8, 103, 0, 8, 39, 0, 9, 175, 0, 8, 7, 0, 8, 135, 0, 8, 71, 0, 9, 239, 80, 7, 9, 0, 8, 95, 0, 8, 31, 0, 9, 159, 84, 7, 99, 0, 8,
  	127, 0, 8, 63, 0, 9, 223, 82, 7, 27, 0, 8, 111, 0, 8, 47, 0, 9, 191, 0, 8, 15, 0, 8, 143, 0, 8, 79, 0, 9, 255];
  const fixed_td = [80, 5, 1, 87, 5, 257, 83, 5, 17, 91, 5, 4097, 81, 5, 5, 89, 5, 1025, 85, 5, 65, 93, 5, 16385, 80, 5, 3, 88, 5, 513, 84, 5, 33, 92, 5,
  	8193, 82, 5, 9, 90, 5, 2049, 86, 5, 129, 192, 5, 24577, 80, 5, 2, 87, 5, 385, 83, 5, 25, 91, 5, 6145, 81, 5, 7, 89, 5, 1537, 85, 5, 97, 93, 5,
  	24577, 80, 5, 4, 88, 5, 769, 84, 5, 49, 92, 5, 12289, 82, 5, 13, 90, 5, 3073, 86, 5, 193, 192, 5, 24577];

  // Tables for deflate from PKZIP's appnote.txt.
  const cplens = [ // Copy lengths for literal codes 257..285
  	3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0];

  // see note #13 above about 258
  const cplext = [ // Extra bits for literal codes 257..285
  	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 112, 112 // 112==invalid
  ];

  const cpdist = [ // Copy offsets for distance codes 0..29
  	1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];

  const cpdext = [ // Extra bits for distance codes
  	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  // If BMAX needs to be larger than 16, then h and x[] should be uLong.
  const BMAX = 15; // maximum bit length of any code

  function InfTree() {
  	const that = this;

  	let hn; // hufts used in space
  	let v; // work area for huft_build
  	let c; // bit length count table
  	let r; // table entry for structure assignment
  	let u; // table stack
  	let x; // bit offsets, then code stack

  	function huft_build(b, // code lengths in bits (all assumed <=
  		// BMAX)
  		bindex, n, // number of codes (assumed <= 288)
  		s, // number of simple-valued codes (0..s-1)
  		d, // list of base values for non-simple codes
  		e, // list of extra bits for non-simple codes
  		t, // result: starting table
  		m, // maximum lookup bits, returns actual
  		hp,// space for trees
  		hn,// hufts used in space
  		v // working area: values in order of bit length
  	) {
  		// Given a list of code lengths and a maximum table size, make a set of
  		// tables to decode that set of codes. Return Z_OK on success,
  		// Z_BUF_ERROR
  		// if the given code set is incomplete (the tables are still built in
  		// this
  		// case), Z_DATA_ERROR if the input is invalid (an over-subscribed set
  		// of
  		// lengths), or Z_MEM_ERROR if not enough memory.

  		let a; // counter for codes of length k
  		let f; // i repeats in table every f entries
  		let g; // maximum code length
  		let h; // table level
  		let i; // counter, current code
  		let j; // counter
  		let k; // number of bits in current code
  		let l; // bits per table (returned in m)
  		let mask; // (1 << w) - 1, to avoid cc -O bug on HP
  		let p; // pointer into c[], b[], or v[]
  		let q; // points to current table
  		let w; // bits before this table == (l * h)
  		let xp; // pointer into x
  		let y; // number of dummy codes added
  		let z; // number of entries in current table

  		// Generate counts for each bit length

  		p = 0;
  		i = n;
  		do {
  			c[b[bindex + p]]++;
  			p++;
  			i--; // assume all entries <= BMAX
  		} while (i !== 0);

  		if (c[0] == n) { // null input--all zero length codes
  			t[0] = -1;
  			m[0] = 0;
  			return Z_OK;
  		}

  		// Find minimum and maximum length, bound *m by those
  		l = m[0];
  		for (j = 1; j <= BMAX; j++)
  			if (c[j] !== 0)
  				break;
  		k = j; // minimum code length
  		if (l < j) {
  			l = j;
  		}
  		for (i = BMAX; i !== 0; i--) {
  			if (c[i] !== 0)
  				break;
  		}
  		g = i; // maximum code length
  		if (l > i) {
  			l = i;
  		}
  		m[0] = l;

  		// Adjust last length count to fill out codes, if needed
  		for (y = 1 << j; j < i; j++, y <<= 1) {
  			if ((y -= c[j]) < 0) {
  				return Z_DATA_ERROR;
  			}
  		}
  		if ((y -= c[i]) < 0) {
  			return Z_DATA_ERROR;
  		}
  		c[i] += y;

  		// Generate starting offsets into the value table for each length
  		x[1] = j = 0;
  		p = 1;
  		xp = 2;
  		while (--i !== 0) { // note that i == g from above
  			x[xp] = (j += c[p]);
  			xp++;
  			p++;
  		}

  		// Make a table of values in order of bit lengths
  		i = 0;
  		p = 0;
  		do {
  			if ((j = b[bindex + p]) !== 0) {
  				v[x[j]++] = i;
  			}
  			p++;
  		} while (++i < n);
  		n = x[g]; // set n to length of v

  		// Generate the Huffman codes and for each, make the table entries
  		x[0] = i = 0; // first Huffman code is zero
  		p = 0; // grab values in bit order
  		h = -1; // no tables yet--level -1
  		w = -l; // bits decoded == (l * h)
  		u[0] = 0; // just to keep compilers happy
  		q = 0; // ditto
  		z = 0; // ditto

  		// go through the bit lengths (k already is bits in shortest code)
  		for (; k <= g; k++) {
  			a = c[k];
  			while (a-- !== 0) {
  				// here i is the Huffman code of length k bits for value *p
  				// make tables up to required level
  				while (k > w + l) {
  					h++;
  					w += l; // previous table always l bits
  					// compute minimum size table less than or equal to l bits
  					z = g - w;
  					z = (z > l) ? l : z; // table size upper limit
  					if ((f = 1 << (j = k - w)) > a + 1) { // try a k-w bit table
  						// too few codes for
  						// k-w bit table
  						f -= a + 1; // deduct codes from patterns left
  						xp = k;
  						if (j < z) {
  							while (++j < z) { // try smaller tables up to z bits
  								if ((f <<= 1) <= c[++xp])
  									break; // enough codes to use up j bits
  								f -= c[xp]; // else deduct codes from patterns
  							}
  						}
  					}
  					z = 1 << j; // table entries for j-bit table

  					// allocate new table
  					if (hn[0] + z > MANY) { // (note: doesn't matter for fixed)
  						return Z_DATA_ERROR; // overflow of MANY
  					}
  					u[h] = q = /* hp+ */hn[0]; // DEBUG
  					hn[0] += z;

  					// connect to last table, if there is one
  					if (h !== 0) {
  						x[h] = i; // save pattern for backing up
  						r[0] = /* (byte) */j; // bits in this table
  						r[1] = /* (byte) */l; // bits to dump before this table
  						j = i >>> (w - l);
  						r[2] = /* (int) */(q - u[h - 1] - j); // offset to this table
  						hp.set(r, (u[h - 1] + j) * 3);
  						// to
  						// last
  						// table
  					} else {
  						t[0] = q; // first table is returned result
  					}
  				}

  				// set up table entry in r
  				r[1] = /* (byte) */(k - w);
  				if (p >= n) {
  					r[0] = 128 + 64; // out of values--invalid code
  				} else if (v[p] < s) {
  					r[0] = /* (byte) */(v[p] < 256 ? 0 : 32 + 64); // 256 is
  					// end-of-block
  					r[2] = v[p++]; // simple code is just the value
  				} else {
  					r[0] = /* (byte) */(e[v[p] - s] + 16 + 64); // non-simple--look
  					// up in lists
  					r[2] = d[v[p++] - s];
  				}

  				// fill code-like entries with r
  				f = 1 << (k - w);
  				for (j = i >>> w; j < z; j += f) {
  					hp.set(r, (q + j) * 3);
  				}

  				// backwards increment the k-bit code i
  				for (j = 1 << (k - 1); (i & j) !== 0; j >>>= 1) {
  					i ^= j;
  				}
  				i ^= j;

  				// backup over finished tables
  				mask = (1 << w) - 1; // needed on HP, cc -O bug
  				while ((i & mask) != x[h]) {
  					h--; // don't need to update q
  					w -= l;
  					mask = (1 << w) - 1;
  				}
  			}
  		}
  		// Return Z_BUF_ERROR if we were given an incomplete table
  		return y !== 0 && g != 1 ? Z_BUF_ERROR : Z_OK;
  	}

  	function initWorkArea(vsize) {
  		let i;
  		if (!hn) {
  			hn = []; // []; //new Array(1);
  			v = []; // new Array(vsize);
  			c = new Int32Array(BMAX + 1); // new Array(BMAX + 1);
  			r = []; // new Array(3);
  			u = new Int32Array(BMAX); // new Array(BMAX);
  			x = new Int32Array(BMAX + 1); // new Array(BMAX + 1);
  		}
  		if (v.length < vsize) {
  			v = []; // new Array(vsize);
  		}
  		for (i = 0; i < vsize; i++) {
  			v[i] = 0;
  		}
  		for (i = 0; i < BMAX + 1; i++) {
  			c[i] = 0;
  		}
  		for (i = 0; i < 3; i++) {
  			r[i] = 0;
  		}
  		// for(int i=0; i<BMAX; i++){u[i]=0;}
  		u.set(c.subarray(0, BMAX), 0);
  		// for(int i=0; i<BMAX+1; i++){x[i]=0;}
  		x.set(c.subarray(0, BMAX + 1), 0);
  	}

  	that.inflate_trees_bits = function (c, // 19 code lengths
  		bb, // bits tree desired/actual depth
  		tb, // bits tree result
  		hp, // space for trees
  		z // for messages
  	) {
  		let result;
  		initWorkArea(19);
  		hn[0] = 0;
  		result = huft_build(c, 0, 19, 19, null, null, tb, bb, hp, hn, v);

  		if (result == Z_DATA_ERROR) {
  			z.msg = "oversubscribed dynamic bit lengths tree";
  		} else if (result == Z_BUF_ERROR || bb[0] === 0) {
  			z.msg = "incomplete dynamic bit lengths tree";
  			result = Z_DATA_ERROR;
  		}
  		return result;
  	};

  	that.inflate_trees_dynamic = function (nl, // number of literal/length codes
  		nd, // number of distance codes
  		c, // that many (total) code lengths
  		bl, // literal desired/actual bit depth
  		bd, // distance desired/actual bit depth
  		tl, // literal/length tree result
  		td, // distance tree result
  		hp, // space for trees
  		z // for messages
  	) {
  		let result;

  		// build literal/length tree
  		initWorkArea(288);
  		hn[0] = 0;
  		result = huft_build(c, 0, nl, 257, cplens, cplext, tl, bl, hp, hn, v);
  		if (result != Z_OK || bl[0] === 0) {
  			if (result == Z_DATA_ERROR) {
  				z.msg = "oversubscribed literal/length tree";
  			} else if (result != Z_MEM_ERROR) {
  				z.msg = "incomplete literal/length tree";
  				result = Z_DATA_ERROR;
  			}
  			return result;
  		}

  		// build distance tree
  		initWorkArea(288);
  		result = huft_build(c, nl, nd, 0, cpdist, cpdext, td, bd, hp, hn, v);

  		if (result != Z_OK || (bd[0] === 0 && nl > 257)) {
  			if (result == Z_DATA_ERROR) {
  				z.msg = "oversubscribed distance tree";
  			} else if (result == Z_BUF_ERROR) {
  				z.msg = "incomplete distance tree";
  				result = Z_DATA_ERROR;
  			} else if (result != Z_MEM_ERROR) {
  				z.msg = "empty distance tree with lengths";
  				result = Z_DATA_ERROR;
  			}
  			return result;
  		}

  		return Z_OK;
  	};

  }

  InfTree.inflate_trees_fixed = function (bl, // literal desired/actual bit depth
  	bd, // distance desired/actual bit depth
  	tl,// literal/length tree result
  	td// distance tree result
  ) {
  	bl[0] = fixed_bl;
  	bd[0] = fixed_bd;
  	tl[0] = fixed_tl;
  	td[0] = fixed_td;
  	return Z_OK;
  };

  // InfCodes

  // waiting for "i:"=input,
  // "o:"=output,
  // "x:"=nothing
  const START = 0; // x: set up for LEN
  const LEN = 1; // i: get length/literal/eob next
  const LENEXT = 2; // i: getting length extra (have base)
  const DIST = 3; // i: get distance next
  const DISTEXT = 4;// i: getting distance extra
  const COPY = 5; // o: copying bytes in win, waiting
  // for space
  const LIT = 6; // o: got literal, waiting for output
  // space
  const WASH = 7; // o: got eob, possibly still output
  // waiting
  const END = 8; // x: got eob and all data flushed
  const BADCODE = 9;// x: got error

  function InfCodes() {
  	const that = this;

  	let mode; // current inflate_codes mode

  	// mode dependent information
  	let len = 0;

  	let tree; // pointer into tree
  	let tree_index = 0;
  	let need = 0; // bits needed

  	let lit = 0;

  	// if EXT or COPY, where and how much
  	let get = 0; // bits to get for extra
  	let dist = 0; // distance back to copy from

  	let lbits = 0; // ltree bits decoded per branch
  	let dbits = 0; // dtree bits decoder per branch
  	let ltree; // literal/length/eob tree
  	let ltree_index = 0; // literal/length/eob tree
  	let dtree; // distance tree
  	let dtree_index = 0; // distance tree

  	// Called with number of bytes left to write in win at least 258
  	// (the maximum string length) and number of input bytes available
  	// at least ten. The ten bytes are six bytes for the longest length/
  	// distance pair plus four bytes for overloading the bit buffer.

  	function inflate_fast(bl, bd, tl, tl_index, td, td_index, s, z) {
  		let t; // temporary pointer
  		let tp; // temporary pointer
  		let tp_index; // temporary pointer
  		let e; // extra bits or operation
  		let b; // bit buffer
  		let k; // bits in bit buffer
  		let p; // input data pointer
  		let n; // bytes available there
  		let q; // output win write pointer
  		let m; // bytes to end of win or read pointer
  		let ml; // mask for literal/length tree
  		let md; // mask for distance tree
  		let c; // bytes to copy
  		let d; // distance back to copy from
  		let r; // copy source pointer

  		let tp_index_t_3; // (tp_index+t)*3

  		// load input, output, bit values
  		p = z.next_in_index;
  		n = z.avail_in;
  		b = s.bitb;
  		k = s.bitk;
  		q = s.write;
  		m = q < s.read ? s.read - q - 1 : s.end - q;

  		// initialize masks
  		ml = inflate_mask[bl];
  		md = inflate_mask[bd];

  		// do until not enough input or output space for fast loop
  		do { // assume called with m >= 258 && n >= 10
  			// get literal/length code
  			while (k < (20)) { // max bits for literal/length code
  				n--;
  				b |= (z.read_byte(p++) & 0xff) << k;
  				k += 8;
  			}

  			t = b & ml;
  			tp = tl;
  			tp_index = tl_index;
  			tp_index_t_3 = (tp_index + t) * 3;
  			if ((e = tp[tp_index_t_3]) === 0) {
  				b >>= (tp[tp_index_t_3 + 1]);
  				k -= (tp[tp_index_t_3 + 1]);

  				s.win[q++] = /* (byte) */tp[tp_index_t_3 + 2];
  				m--;
  				continue;
  			}
  			do {

  				b >>= (tp[tp_index_t_3 + 1]);
  				k -= (tp[tp_index_t_3 + 1]);

  				if ((e & 16) !== 0) {
  					e &= 15;
  					c = tp[tp_index_t_3 + 2] + (/* (int) */b & inflate_mask[e]);

  					b >>= e;
  					k -= e;

  					// decode distance base of block to copy
  					while (k < (15)) { // max bits for distance code
  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}

  					t = b & md;
  					tp = td;
  					tp_index = td_index;
  					tp_index_t_3 = (tp_index + t) * 3;
  					e = tp[tp_index_t_3];

  					do {

  						b >>= (tp[tp_index_t_3 + 1]);
  						k -= (tp[tp_index_t_3 + 1]);

  						if ((e & 16) !== 0) {
  							// get extra bits to add to distance base
  							e &= 15;
  							while (k < (e)) { // get extra bits (up to 13)
  								n--;
  								b |= (z.read_byte(p++) & 0xff) << k;
  								k += 8;
  							}

  							d = tp[tp_index_t_3 + 2] + (b & inflate_mask[e]);

  							b >>= (e);
  							k -= (e);

  							// do the copy
  							m -= c;
  							if (q >= d) { // offset before dest
  								// just copy
  								r = q - d;
  								if (q - r > 0 && 2 > (q - r)) {
  									s.win[q++] = s.win[r++]; // minimum
  									// count is
  									// three,
  									s.win[q++] = s.win[r++]; // so unroll
  									// loop a
  									// little
  									c -= 2;
  								} else {
  									s.win.set(s.win.subarray(r, r + 2), q);
  									q += 2;
  									r += 2;
  									c -= 2;
  								}
  							} else { // else offset after destination
  								r = q - d;
  								do {
  									r += s.end; // force pointer in win
  								} while (r < 0); // covers invalid distances
  								e = s.end - r;
  								if (c > e) { // if source crosses,
  									c -= e; // wrapped copy
  									if (q - r > 0 && e > (q - r)) {
  										do {
  											s.win[q++] = s.win[r++];
  										} while (--e !== 0);
  									} else {
  										s.win.set(s.win.subarray(r, r + e), q);
  										q += e;
  										r += e;
  										e = 0;
  									}
  									r = 0; // copy rest from start of win
  								}

  							}

  							// copy all or what's left
  							if (q - r > 0 && c > (q - r)) {
  								do {
  									s.win[q++] = s.win[r++];
  								} while (--c !== 0);
  							} else {
  								s.win.set(s.win.subarray(r, r + c), q);
  								q += c;
  								r += c;
  								c = 0;
  							}
  							break;
  						} else if ((e & 64) === 0) {
  							t += tp[tp_index_t_3 + 2];
  							t += (b & inflate_mask[e]);
  							tp_index_t_3 = (tp_index + t) * 3;
  							e = tp[tp_index_t_3];
  						} else {
  							z.msg = "invalid distance code";

  							c = z.avail_in - n;
  							c = (k >> 3) < c ? k >> 3 : c;
  							n += c;
  							p -= c;
  							k -= c << 3;

  							s.bitb = b;
  							s.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							s.write = q;

  							return Z_DATA_ERROR;
  						}
  						// eslint-disable-next-line no-constant-condition
  					} while (true);
  					break;
  				}

  				if ((e & 64) === 0) {
  					t += tp[tp_index_t_3 + 2];
  					t += (b & inflate_mask[e]);
  					tp_index_t_3 = (tp_index + t) * 3;
  					if ((e = tp[tp_index_t_3]) === 0) {

  						b >>= (tp[tp_index_t_3 + 1]);
  						k -= (tp[tp_index_t_3 + 1]);

  						s.win[q++] = /* (byte) */tp[tp_index_t_3 + 2];
  						m--;
  						break;
  					}
  				} else if ((e & 32) !== 0) {

  					c = z.avail_in - n;
  					c = (k >> 3) < c ? k >> 3 : c;
  					n += c;
  					p -= c;
  					k -= c << 3;

  					s.bitb = b;
  					s.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					s.write = q;

  					return Z_STREAM_END;
  				} else {
  					z.msg = "invalid literal/length code";

  					c = z.avail_in - n;
  					c = (k >> 3) < c ? k >> 3 : c;
  					n += c;
  					p -= c;
  					k -= c << 3;

  					s.bitb = b;
  					s.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					s.write = q;

  					return Z_DATA_ERROR;
  				}
  				// eslint-disable-next-line no-constant-condition
  			} while (true);
  		} while (m >= 258 && n >= 10);

  		// not enough input or output--restore pointers and return
  		c = z.avail_in - n;
  		c = (k >> 3) < c ? k >> 3 : c;
  		n += c;
  		p -= c;
  		k -= c << 3;

  		s.bitb = b;
  		s.bitk = k;
  		z.avail_in = n;
  		z.total_in += p - z.next_in_index;
  		z.next_in_index = p;
  		s.write = q;

  		return Z_OK;
  	}

  	that.init = function (bl, bd, tl, tl_index, td, td_index) {
  		mode = START;
  		lbits = /* (byte) */bl;
  		dbits = /* (byte) */bd;
  		ltree = tl;
  		ltree_index = tl_index;
  		dtree = td;
  		dtree_index = td_index;
  		tree = null;
  	};

  	that.proc = function (s, z, r) {
  		let j; // temporary storage
  		let tindex; // temporary pointer
  		let e; // extra bits or operation
  		let b = 0; // bit buffer
  		let k = 0; // bits in bit buffer
  		let p = 0; // input data pointer
  		let n; // bytes available there
  		let q; // output win write pointer
  		let m; // bytes to end of win or read pointer
  		let f; // pointer to copy strings from

  		// copy input/output information to locals (UPDATE macro restores)
  		p = z.next_in_index;
  		n = z.avail_in;
  		b = s.bitb;
  		k = s.bitk;
  		q = s.write;
  		m = q < s.read ? s.read - q - 1 : s.end - q;

  		// process input and output based on current state
  		// eslint-disable-next-line no-constant-condition
  		while (true) {
  			switch (mode) {
  				// waiting for "i:"=input, "o:"=output, "x:"=nothing
  				case START: // x: set up for LEN
  					if (m >= 258 && n >= 10) {

  						s.bitb = b;
  						s.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						s.write = q;
  						r = inflate_fast(lbits, dbits, ltree, ltree_index, dtree, dtree_index, s, z);

  						p = z.next_in_index;
  						n = z.avail_in;
  						b = s.bitb;
  						k = s.bitk;
  						q = s.write;
  						m = q < s.read ? s.read - q - 1 : s.end - q;

  						if (r != Z_OK) {
  							mode = r == Z_STREAM_END ? WASH : BADCODE;
  							break;
  						}
  					}
  					need = lbits;
  					tree = ltree;
  					tree_index = ltree_index;

  					mode = LEN;
  				/* falls through */
  				case LEN: // i: get length/literal/eob next
  					j = need;

  					while (k < (j)) {
  						if (n !== 0)
  							r = Z_OK;
  						else {

  							s.bitb = b;
  							s.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							s.write = q;
  							return s.inflate_flush(z, r);
  						}
  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}

  					tindex = (tree_index + (b & inflate_mask[j])) * 3;

  					b >>>= (tree[tindex + 1]);
  					k -= (tree[tindex + 1]);

  					e = tree[tindex];

  					if (e === 0) { // literal
  						lit = tree[tindex + 2];
  						mode = LIT;
  						break;
  					}
  					if ((e & 16) !== 0) { // length
  						get = e & 15;
  						len = tree[tindex + 2];
  						mode = LENEXT;
  						break;
  					}
  					if ((e & 64) === 0) { // next table
  						need = e;
  						tree_index = tindex / 3 + tree[tindex + 2];
  						break;
  					}
  					if ((e & 32) !== 0) { // end of block
  						mode = WASH;
  						break;
  					}
  					mode = BADCODE; // invalid code
  					z.msg = "invalid literal/length code";
  					r = Z_DATA_ERROR;

  					s.bitb = b;
  					s.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					s.write = q;
  					return s.inflate_flush(z, r);

  				case LENEXT: // i: getting length extra (have base)
  					j = get;

  					while (k < (j)) {
  						if (n !== 0)
  							r = Z_OK;
  						else {

  							s.bitb = b;
  							s.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							s.write = q;
  							return s.inflate_flush(z, r);
  						}
  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}

  					len += (b & inflate_mask[j]);

  					b >>= j;
  					k -= j;

  					need = dbits;
  					tree = dtree;
  					tree_index = dtree_index;
  					mode = DIST;
  				/* falls through */
  				case DIST: // i: get distance next
  					j = need;

  					while (k < (j)) {
  						if (n !== 0)
  							r = Z_OK;
  						else {

  							s.bitb = b;
  							s.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							s.write = q;
  							return s.inflate_flush(z, r);
  						}
  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}

  					tindex = (tree_index + (b & inflate_mask[j])) * 3;

  					b >>= tree[tindex + 1];
  					k -= tree[tindex + 1];

  					e = (tree[tindex]);
  					if ((e & 16) !== 0) { // distance
  						get = e & 15;
  						dist = tree[tindex + 2];
  						mode = DISTEXT;
  						break;
  					}
  					if ((e & 64) === 0) { // next table
  						need = e;
  						tree_index = tindex / 3 + tree[tindex + 2];
  						break;
  					}
  					mode = BADCODE; // invalid code
  					z.msg = "invalid distance code";
  					r = Z_DATA_ERROR;

  					s.bitb = b;
  					s.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					s.write = q;
  					return s.inflate_flush(z, r);

  				case DISTEXT: // i: getting distance extra
  					j = get;

  					while (k < (j)) {
  						if (n !== 0)
  							r = Z_OK;
  						else {

  							s.bitb = b;
  							s.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							s.write = q;
  							return s.inflate_flush(z, r);
  						}
  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}

  					dist += (b & inflate_mask[j]);

  					b >>= j;
  					k -= j;

  					mode = COPY;
  				/* falls through */
  				case COPY: // o: copying bytes in win, waiting for space
  					f = q - dist;
  					while (f < 0) { // modulo win size-"while" instead
  						f += s.end; // of "if" handles invalid distances
  					}
  					while (len !== 0) {

  						if (m === 0) {
  							if (q == s.end && s.read !== 0) {
  								q = 0;
  								m = q < s.read ? s.read - q - 1 : s.end - q;
  							}
  							if (m === 0) {
  								s.write = q;
  								r = s.inflate_flush(z, r);
  								q = s.write;
  								m = q < s.read ? s.read - q - 1 : s.end - q;

  								if (q == s.end && s.read !== 0) {
  									q = 0;
  									m = q < s.read ? s.read - q - 1 : s.end - q;
  								}

  								if (m === 0) {
  									s.bitb = b;
  									s.bitk = k;
  									z.avail_in = n;
  									z.total_in += p - z.next_in_index;
  									z.next_in_index = p;
  									s.write = q;
  									return s.inflate_flush(z, r);
  								}
  							}
  						}

  						s.win[q++] = s.win[f++];
  						m--;

  						if (f == s.end)
  							f = 0;
  						len--;
  					}
  					mode = START;
  					break;
  				case LIT: // o: got literal, waiting for output space
  					if (m === 0) {
  						if (q == s.end && s.read !== 0) {
  							q = 0;
  							m = q < s.read ? s.read - q - 1 : s.end - q;
  						}
  						if (m === 0) {
  							s.write = q;
  							r = s.inflate_flush(z, r);
  							q = s.write;
  							m = q < s.read ? s.read - q - 1 : s.end - q;

  							if (q == s.end && s.read !== 0) {
  								q = 0;
  								m = q < s.read ? s.read - q - 1 : s.end - q;
  							}
  							if (m === 0) {
  								s.bitb = b;
  								s.bitk = k;
  								z.avail_in = n;
  								z.total_in += p - z.next_in_index;
  								z.next_in_index = p;
  								s.write = q;
  								return s.inflate_flush(z, r);
  							}
  						}
  					}
  					r = Z_OK;

  					s.win[q++] = /* (byte) */lit;
  					m--;

  					mode = START;
  					break;
  				case WASH: // o: got eob, possibly more output
  					if (k > 7) { // return unused byte, if any
  						k -= 8;
  						n++;
  						p--; // can always return one
  					}

  					s.write = q;
  					r = s.inflate_flush(z, r);
  					q = s.write;
  					m = q < s.read ? s.read - q - 1 : s.end - q;

  					if (s.read != s.write) {
  						s.bitb = b;
  						s.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						s.write = q;
  						return s.inflate_flush(z, r);
  					}
  					mode = END;
  				/* falls through */
  				case END:
  					r = Z_STREAM_END;
  					s.bitb = b;
  					s.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					s.write = q;
  					return s.inflate_flush(z, r);

  				case BADCODE: // x: got error

  					r = Z_DATA_ERROR;

  					s.bitb = b;
  					s.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					s.write = q;
  					return s.inflate_flush(z, r);

  				default:
  					r = Z_STREAM_ERROR;

  					s.bitb = b;
  					s.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					s.write = q;
  					return s.inflate_flush(z, r);
  			}
  		}
  	};

  	that.free = function () {
  		// ZFREE(z, c);
  	};

  }

  // InfBlocks

  // Table for deflate from PKZIP's appnote.txt.
  const border = [ // Order of the bit length code lengths
  	16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  const TYPE = 0; // get type bits (3, including end bit)
  const LENS = 1; // get lengths for stored
  const STORED = 2;// processing stored block
  const TABLE = 3; // get table lengths
  const BTREE = 4; // get bit lengths tree for a dynamic
  // block
  const DTREE = 5; // get length, distance trees for a
  // dynamic block
  const CODES = 6; // processing fixed or dynamic block
  const DRY = 7; // output remaining win bytes
  const DONELOCKS = 8; // finished last block, done
  const BADBLOCKS = 9; // ot a data error--stuck here

  function InfBlocks(z, w) {
  	const that = this;

  	let mode = TYPE; // current inflate_block mode

  	let left = 0; // if STORED, bytes left to copy

  	let table = 0; // table lengths (14 bits)
  	let index = 0; // index into blens (or border)
  	let blens; // bit lengths of codes
  	const bb = [0]; // bit length tree depth
  	const tb = [0]; // bit length decoding tree

  	const codes = new InfCodes(); // if CODES, current state

  	let last = 0; // true if this block is the last block

  	let hufts = new Int32Array(MANY * 3); // single malloc for tree space
  	const check = 0; // check on output
  	const inftree = new InfTree();

  	that.bitk = 0; // bits in bit buffer
  	that.bitb = 0; // bit buffer
  	that.win = new Uint8Array(w); // sliding win
  	that.end = w; // one byte after sliding win
  	that.read = 0; // win read pointer
  	that.write = 0; // win write pointer

  	that.reset = function (z, c) {
  		if (c)
  			c[0] = check;
  		// if (mode == BTREE || mode == DTREE) {
  		// }
  		if (mode == CODES) {
  			codes.free(z);
  		}
  		mode = TYPE;
  		that.bitk = 0;
  		that.bitb = 0;
  		that.read = that.write = 0;
  	};

  	that.reset(z, null);

  	// copy as much as possible from the sliding win to the output area
  	that.inflate_flush = function (z, r) {
  		let n;
  		let p;
  		let q;

  		// local copies of source and destination pointers
  		p = z.next_out_index;
  		q = that.read;

  		// compute number of bytes to copy as far as end of win
  		n = /* (int) */((q <= that.write ? that.write : that.end) - q);
  		if (n > z.avail_out)
  			n = z.avail_out;
  		if (n !== 0 && r == Z_BUF_ERROR)
  			r = Z_OK;

  		// update counters
  		z.avail_out -= n;
  		z.total_out += n;

  		// copy as far as end of win
  		z.next_out.set(that.win.subarray(q, q + n), p);
  		p += n;
  		q += n;

  		// see if more to copy at beginning of win
  		if (q == that.end) {
  			// wrap pointers
  			q = 0;
  			if (that.write == that.end)
  				that.write = 0;

  			// compute bytes to copy
  			n = that.write - q;
  			if (n > z.avail_out)
  				n = z.avail_out;
  			if (n !== 0 && r == Z_BUF_ERROR)
  				r = Z_OK;

  			// update counters
  			z.avail_out -= n;
  			z.total_out += n;

  			// copy
  			z.next_out.set(that.win.subarray(q, q + n), p);
  			p += n;
  			q += n;
  		}

  		// update pointers
  		z.next_out_index = p;
  		that.read = q;

  		// done
  		return r;
  	};

  	that.proc = function (z, r) {
  		let t; // temporary storage
  		let b; // bit buffer
  		let k; // bits in bit buffer
  		let p; // input data pointer
  		let n; // bytes available there
  		let q; // output win write pointer
  		let m; // bytes to end of win or read pointer

  		let i;

  		// copy input/output information to locals (UPDATE macro restores)
  		// {
  		p = z.next_in_index;
  		n = z.avail_in;
  		b = that.bitb;
  		k = that.bitk;
  		// }
  		// {
  		q = that.write;
  		m = /* (int) */(q < that.read ? that.read - q - 1 : that.end - q);
  		// }

  		// process input based on current state
  		// DEBUG dtree
  		// eslint-disable-next-line no-constant-condition
  		while (true) {
  			let bl, bd, tl, td, bl_, bd_, tl_, td_;
  			switch (mode) {
  				case TYPE:

  					while (k < (3)) {
  						if (n !== 0) {
  							r = Z_OK;
  						} else {
  							that.bitb = b;
  							that.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							that.write = q;
  							return that.inflate_flush(z, r);
  						}
  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}
  					t = /* (int) */(b & 7);
  					last = t & 1;

  					switch (t >>> 1) {
  						case 0: // stored
  							// {
  							b >>>= (3);
  							k -= (3);
  							// }
  							t = k & 7; // go to byte boundary

  							// {
  							b >>>= (t);
  							k -= (t);
  							// }
  							mode = LENS; // get length of stored block
  							break;
  						case 1: // fixed
  							// {
  							bl = []; // new Array(1);
  							bd = []; // new Array(1);
  							tl = [[]]; // new Array(1);
  							td = [[]]; // new Array(1);

  							InfTree.inflate_trees_fixed(bl, bd, tl, td);
  							codes.init(bl[0], bd[0], tl[0], 0, td[0], 0);
  							// }

  							// {
  							b >>>= (3);
  							k -= (3);
  							// }

  							mode = CODES;
  							break;
  						case 2: // dynamic

  							// {
  							b >>>= (3);
  							k -= (3);
  							// }

  							mode = TABLE;
  							break;
  						case 3: // illegal

  							// {
  							b >>>= (3);
  							k -= (3);
  							// }
  							mode = BADBLOCKS;
  							z.msg = "invalid block type";
  							r = Z_DATA_ERROR;

  							that.bitb = b;
  							that.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							that.write = q;
  							return that.inflate_flush(z, r);
  					}
  					break;
  				case LENS:

  					while (k < (32)) {
  						if (n !== 0) {
  							r = Z_OK;
  						} else {
  							that.bitb = b;
  							that.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							that.write = q;
  							return that.inflate_flush(z, r);
  						}
  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}

  					if ((((~b) >>> 16) & 0xffff) != (b & 0xffff)) {
  						mode = BADBLOCKS;
  						z.msg = "invalid stored block lengths";
  						r = Z_DATA_ERROR;

  						that.bitb = b;
  						that.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						that.write = q;
  						return that.inflate_flush(z, r);
  					}
  					left = (b & 0xffff);
  					b = k = 0; // dump bits
  					mode = left !== 0 ? STORED : (last !== 0 ? DRY : TYPE);
  					break;
  				case STORED:
  					if (n === 0) {
  						that.bitb = b;
  						that.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						that.write = q;
  						return that.inflate_flush(z, r);
  					}

  					if (m === 0) {
  						if (q == that.end && that.read !== 0) {
  							q = 0;
  							m = /* (int) */(q < that.read ? that.read - q - 1 : that.end - q);
  						}
  						if (m === 0) {
  							that.write = q;
  							r = that.inflate_flush(z, r);
  							q = that.write;
  							m = /* (int) */(q < that.read ? that.read - q - 1 : that.end - q);
  							if (q == that.end && that.read !== 0) {
  								q = 0;
  								m = /* (int) */(q < that.read ? that.read - q - 1 : that.end - q);
  							}
  							if (m === 0) {
  								that.bitb = b;
  								that.bitk = k;
  								z.avail_in = n;
  								z.total_in += p - z.next_in_index;
  								z.next_in_index = p;
  								that.write = q;
  								return that.inflate_flush(z, r);
  							}
  						}
  					}
  					r = Z_OK;

  					t = left;
  					if (t > n)
  						t = n;
  					if (t > m)
  						t = m;
  					that.win.set(z.read_buf(p, t), q);
  					p += t;
  					n -= t;
  					q += t;
  					m -= t;
  					if ((left -= t) !== 0)
  						break;
  					mode = last !== 0 ? DRY : TYPE;
  					break;
  				case TABLE:

  					while (k < (14)) {
  						if (n !== 0) {
  							r = Z_OK;
  						} else {
  							that.bitb = b;
  							that.bitk = k;
  							z.avail_in = n;
  							z.total_in += p - z.next_in_index;
  							z.next_in_index = p;
  							that.write = q;
  							return that.inflate_flush(z, r);
  						}

  						n--;
  						b |= (z.read_byte(p++) & 0xff) << k;
  						k += 8;
  					}

  					table = t = (b & 0x3fff);
  					if ((t & 0x1f) > 29 || ((t >> 5) & 0x1f) > 29) {
  						mode = BADBLOCKS;
  						z.msg = "too many length or distance symbols";
  						r = Z_DATA_ERROR;

  						that.bitb = b;
  						that.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						that.write = q;
  						return that.inflate_flush(z, r);
  					}
  					t = 258 + (t & 0x1f) + ((t >> 5) & 0x1f);
  					if (!blens || blens.length < t) {
  						blens = []; // new Array(t);
  					} else {
  						for (i = 0; i < t; i++) {
  							blens[i] = 0;
  						}
  					}

  					// {
  					b >>>= (14);
  					k -= (14);
  					// }

  					index = 0;
  					mode = BTREE;
  				/* falls through */
  				case BTREE:
  					while (index < 4 + (table >>> 10)) {
  						while (k < (3)) {
  							if (n !== 0) {
  								r = Z_OK;
  							} else {
  								that.bitb = b;
  								that.bitk = k;
  								z.avail_in = n;
  								z.total_in += p - z.next_in_index;
  								z.next_in_index = p;
  								that.write = q;
  								return that.inflate_flush(z, r);
  							}
  							n--;
  							b |= (z.read_byte(p++) & 0xff) << k;
  							k += 8;
  						}

  						blens[border[index++]] = b & 7;

  						// {
  						b >>>= (3);
  						k -= (3);
  						// }
  					}

  					while (index < 19) {
  						blens[border[index++]] = 0;
  					}

  					bb[0] = 7;
  					t = inftree.inflate_trees_bits(blens, bb, tb, hufts, z);
  					if (t != Z_OK) {
  						r = t;
  						if (r == Z_DATA_ERROR) {
  							blens = null;
  							mode = BADBLOCKS;
  						}

  						that.bitb = b;
  						that.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						that.write = q;
  						return that.inflate_flush(z, r);
  					}

  					index = 0;
  					mode = DTREE;
  				/* falls through */
  				case DTREE:
  					// eslint-disable-next-line no-constant-condition
  					while (true) {
  						t = table;
  						if (index >= 258 + (t & 0x1f) + ((t >> 5) & 0x1f)) {
  							break;
  						}

  						let j, c;

  						t = bb[0];

  						while (k < (t)) {
  							if (n !== 0) {
  								r = Z_OK;
  							} else {
  								that.bitb = b;
  								that.bitk = k;
  								z.avail_in = n;
  								z.total_in += p - z.next_in_index;
  								z.next_in_index = p;
  								that.write = q;
  								return that.inflate_flush(z, r);
  							}
  							n--;
  							b |= (z.read_byte(p++) & 0xff) << k;
  							k += 8;
  						}

  						// if (tb[0] == -1) {
  						// System.err.println("null...");
  						// }

  						t = hufts[(tb[0] + (b & inflate_mask[t])) * 3 + 1];
  						c = hufts[(tb[0] + (b & inflate_mask[t])) * 3 + 2];

  						if (c < 16) {
  							b >>>= (t);
  							k -= (t);
  							blens[index++] = c;
  						} else { // c == 16..18
  							i = c == 18 ? 7 : c - 14;
  							j = c == 18 ? 11 : 3;

  							while (k < (t + i)) {
  								if (n !== 0) {
  									r = Z_OK;
  								} else {
  									that.bitb = b;
  									that.bitk = k;
  									z.avail_in = n;
  									z.total_in += p - z.next_in_index;
  									z.next_in_index = p;
  									that.write = q;
  									return that.inflate_flush(z, r);
  								}
  								n--;
  								b |= (z.read_byte(p++) & 0xff) << k;
  								k += 8;
  							}

  							b >>>= (t);
  							k -= (t);

  							j += (b & inflate_mask[i]);

  							b >>>= (i);
  							k -= (i);

  							i = index;
  							t = table;
  							if (i + j > 258 + (t & 0x1f) + ((t >> 5) & 0x1f) || (c == 16 && i < 1)) {
  								blens = null;
  								mode = BADBLOCKS;
  								z.msg = "invalid bit length repeat";
  								r = Z_DATA_ERROR;

  								that.bitb = b;
  								that.bitk = k;
  								z.avail_in = n;
  								z.total_in += p - z.next_in_index;
  								z.next_in_index = p;
  								that.write = q;
  								return that.inflate_flush(z, r);
  							}

  							c = c == 16 ? blens[i - 1] : 0;
  							do {
  								blens[i++] = c;
  							} while (--j !== 0);
  							index = i;
  						}
  					}

  					tb[0] = -1;
  					// {
  					bl_ = []; // new Array(1);
  					bd_ = []; // new Array(1);
  					tl_ = []; // new Array(1);
  					td_ = []; // new Array(1);
  					bl_[0] = 9; // must be <= 9 for lookahead assumptions
  					bd_[0] = 6; // must be <= 9 for lookahead assumptions

  					t = table;
  					t = inftree.inflate_trees_dynamic(257 + (t & 0x1f), 1 + ((t >> 5) & 0x1f), blens, bl_, bd_, tl_, td_, hufts, z);

  					if (t != Z_OK) {
  						if (t == Z_DATA_ERROR) {
  							blens = null;
  							mode = BADBLOCKS;
  						}
  						r = t;

  						that.bitb = b;
  						that.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						that.write = q;
  						return that.inflate_flush(z, r);
  					}
  					codes.init(bl_[0], bd_[0], hufts, tl_[0], hufts, td_[0]);
  					// }
  					mode = CODES;
  				/* falls through */
  				case CODES:
  					that.bitb = b;
  					that.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					that.write = q;

  					if ((r = codes.proc(that, z, r)) != Z_STREAM_END) {
  						return that.inflate_flush(z, r);
  					}
  					r = Z_OK;
  					codes.free(z);

  					p = z.next_in_index;
  					n = z.avail_in;
  					b = that.bitb;
  					k = that.bitk;
  					q = that.write;
  					m = /* (int) */(q < that.read ? that.read - q - 1 : that.end - q);

  					if (last === 0) {
  						mode = TYPE;
  						break;
  					}
  					mode = DRY;
  				/* falls through */
  				case DRY:
  					that.write = q;
  					r = that.inflate_flush(z, r);
  					q = that.write;
  					m = /* (int) */(q < that.read ? that.read - q - 1 : that.end - q);
  					if (that.read != that.write) {
  						that.bitb = b;
  						that.bitk = k;
  						z.avail_in = n;
  						z.total_in += p - z.next_in_index;
  						z.next_in_index = p;
  						that.write = q;
  						return that.inflate_flush(z, r);
  					}
  					mode = DONELOCKS;
  				/* falls through */
  				case DONELOCKS:
  					r = Z_STREAM_END;

  					that.bitb = b;
  					that.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					that.write = q;
  					return that.inflate_flush(z, r);
  				case BADBLOCKS:
  					r = Z_DATA_ERROR;

  					that.bitb = b;
  					that.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					that.write = q;
  					return that.inflate_flush(z, r);

  				default:
  					r = Z_STREAM_ERROR;

  					that.bitb = b;
  					that.bitk = k;
  					z.avail_in = n;
  					z.total_in += p - z.next_in_index;
  					z.next_in_index = p;
  					that.write = q;
  					return that.inflate_flush(z, r);
  			}
  		}
  	};

  	that.free = function (z) {
  		that.reset(z, null);
  		that.win = null;
  		hufts = null;
  		// ZFREE(z, s);
  	};

  	that.set_dictionary = function (d, start, n) {
  		that.win.set(d.subarray(start, start + n), 0);
  		that.read = that.write = n;
  	};

  	// Returns true if inflate is currently at the end of a block generated
  	// by Z_SYNC_FLUSH or Z_FULL_FLUSH.
  	that.sync_point = function () {
  		return mode == LENS ? 1 : 0;
  	};

  }

  // Inflate

  // preset dictionary flag in zlib header
  const PRESET_DICT = 0x20;

  const Z_DEFLATED = 8;

  const METHOD = 0; // waiting for method byte
  const FLAG = 1; // waiting for flag byte
  const DICT4 = 2; // four dictionary check bytes to go
  const DICT3 = 3; // three dictionary check bytes to go
  const DICT2 = 4; // two dictionary check bytes to go
  const DICT1 = 5; // one dictionary check byte to go
  const DICT0 = 6; // waiting for inflateSetDictionary
  const BLOCKS = 7; // decompressing blocks
  const DONE = 12; // finished check, done
  const BAD = 13; // got an error--stay here

  const mark = [0, 0, 0xff, 0xff];

  function Inflate() {
  	const that = this;

  	that.mode = 0; // current inflate mode

  	// mode dependent information
  	that.method = 0; // if FLAGS, method byte

  	// if CHECK, check values to compare
  	that.was = [0]; // new Array(1); // computed check value
  	that.need = 0; // stream check value

  	// if BAD, inflateSync's marker bytes count
  	that.marker = 0;

  	// mode independent information
  	that.wbits = 0; // log2(win size) (8..15, defaults to 15)

  	// this.blocks; // current inflate_blocks state

  	function inflateReset(z) {
  		if (!z || !z.istate)
  			return Z_STREAM_ERROR;

  		z.total_in = z.total_out = 0;
  		z.msg = null;
  		z.istate.mode = BLOCKS;
  		z.istate.blocks.reset(z, null);
  		return Z_OK;
  	}

  	that.inflateEnd = function (z) {
  		if (that.blocks)
  			that.blocks.free(z);
  		that.blocks = null;
  		// ZFREE(z, z->state);
  		return Z_OK;
  	};

  	that.inflateInit = function (z, w) {
  		z.msg = null;
  		that.blocks = null;

  		// set win size
  		if (w < 8 || w > 15) {
  			that.inflateEnd(z);
  			return Z_STREAM_ERROR;
  		}
  		that.wbits = w;

  		z.istate.blocks = new InfBlocks(z, 1 << w);

  		// reset state
  		inflateReset(z);
  		return Z_OK;
  	};

  	that.inflate = function (z, f) {
  		let r;
  		let b;

  		if (!z || !z.istate || !z.next_in)
  			return Z_STREAM_ERROR;
  		const istate = z.istate;
  		f = f == Z_FINISH ? Z_BUF_ERROR : Z_OK;
  		r = Z_BUF_ERROR;
  		// eslint-disable-next-line no-constant-condition
  		while (true) {
  			switch (istate.mode) {
  				case METHOD:

  					if (z.avail_in === 0)
  						return r;
  					r = f;

  					z.avail_in--;
  					z.total_in++;
  					if (((istate.method = z.read_byte(z.next_in_index++)) & 0xf) != Z_DEFLATED) {
  						istate.mode = BAD;
  						z.msg = "unknown compression method";
  						istate.marker = 5; // can't try inflateSync
  						break;
  					}
  					if ((istate.method >> 4) + 8 > istate.wbits) {
  						istate.mode = BAD;
  						z.msg = "invalid win size";
  						istate.marker = 5; // can't try inflateSync
  						break;
  					}
  					istate.mode = FLAG;
  				/* falls through */
  				case FLAG:

  					if (z.avail_in === 0)
  						return r;
  					r = f;

  					z.avail_in--;
  					z.total_in++;
  					b = (z.read_byte(z.next_in_index++)) & 0xff;

  					if ((((istate.method << 8) + b) % 31) !== 0) {
  						istate.mode = BAD;
  						z.msg = "incorrect header check";
  						istate.marker = 5; // can't try inflateSync
  						break;
  					}

  					if ((b & PRESET_DICT) === 0) {
  						istate.mode = BLOCKS;
  						break;
  					}
  					istate.mode = DICT4;
  				/* falls through */
  				case DICT4:

  					if (z.avail_in === 0)
  						return r;
  					r = f;

  					z.avail_in--;
  					z.total_in++;
  					istate.need = ((z.read_byte(z.next_in_index++) & 0xff) << 24) & 0xff000000;
  					istate.mode = DICT3;
  				/* falls through */
  				case DICT3:

  					if (z.avail_in === 0)
  						return r;
  					r = f;

  					z.avail_in--;
  					z.total_in++;
  					istate.need += ((z.read_byte(z.next_in_index++) & 0xff) << 16) & 0xff0000;
  					istate.mode = DICT2;
  				/* falls through */
  				case DICT2:

  					if (z.avail_in === 0)
  						return r;
  					r = f;

  					z.avail_in--;
  					z.total_in++;
  					istate.need += ((z.read_byte(z.next_in_index++) & 0xff) << 8) & 0xff00;
  					istate.mode = DICT1;
  				/* falls through */
  				case DICT1:

  					if (z.avail_in === 0)
  						return r;
  					r = f;

  					z.avail_in--;
  					z.total_in++;
  					istate.need += (z.read_byte(z.next_in_index++) & 0xff);
  					istate.mode = DICT0;
  					return Z_NEED_DICT;
  				case DICT0:
  					istate.mode = BAD;
  					z.msg = "need dictionary";
  					istate.marker = 0; // can try inflateSync
  					return Z_STREAM_ERROR;
  				case BLOCKS:

  					r = istate.blocks.proc(z, r);
  					if (r == Z_DATA_ERROR) {
  						istate.mode = BAD;
  						istate.marker = 0; // can try inflateSync
  						break;
  					}
  					if (r == Z_OK) {
  						r = f;
  					}
  					if (r != Z_STREAM_END) {
  						return r;
  					}
  					r = f;
  					istate.blocks.reset(z, istate.was);
  					istate.mode = DONE;
  				/* falls through */
  				case DONE:
  					z.avail_in = 0;
  					return Z_STREAM_END;
  				case BAD:
  					return Z_DATA_ERROR;
  				default:
  					return Z_STREAM_ERROR;
  			}
  		}
  	};

  	that.inflateSetDictionary = function (z, dictionary, dictLength) {
  		let index = 0, length = dictLength;
  		if (!z || !z.istate || z.istate.mode != DICT0)
  			return Z_STREAM_ERROR;
  		const istate = z.istate;
  		if (length >= (1 << istate.wbits)) {
  			length = (1 << istate.wbits) - 1;
  			index = dictLength - length;
  		}
  		istate.blocks.set_dictionary(dictionary, index, length);
  		istate.mode = BLOCKS;
  		return Z_OK;
  	};

  	that.inflateSync = function (z) {
  		let n; // number of bytes to look at
  		let p; // pointer to bytes
  		let m; // number of marker bytes found in a row
  		let r, w; // temporaries to save total_in and total_out

  		// set up
  		if (!z || !z.istate)
  			return Z_STREAM_ERROR;
  		const istate = z.istate;
  		if (istate.mode != BAD) {
  			istate.mode = BAD;
  			istate.marker = 0;
  		}
  		if ((n = z.avail_in) === 0)
  			return Z_BUF_ERROR;
  		p = z.next_in_index;
  		m = istate.marker;

  		// search
  		while (n !== 0 && m < 4) {
  			if (z.read_byte(p) == mark[m]) {
  				m++;
  			} else if (z.read_byte(p) !== 0) {
  				m = 0;
  			} else {
  				m = 4 - m;
  			}
  			p++;
  			n--;
  		}

  		// restore
  		z.total_in += p - z.next_in_index;
  		z.next_in_index = p;
  		z.avail_in = n;
  		istate.marker = m;

  		// return no joy or set up to restart on a new block
  		if (m != 4) {
  			return Z_DATA_ERROR;
  		}
  		r = z.total_in;
  		w = z.total_out;
  		inflateReset(z);
  		z.total_in = r;
  		z.total_out = w;
  		istate.mode = BLOCKS;
  		return Z_OK;
  	};

  	// Returns true if inflate is currently at the end of a block generated
  	// by Z_SYNC_FLUSH or Z_FULL_FLUSH. This function is used by one PPP
  	// implementation to provide an additional safety check. PPP uses
  	// Z_SYNC_FLUSH
  	// but removes the length bytes of the resulting empty stored block. When
  	// decompressing, PPP checks that at the end of input packet, inflate is
  	// waiting for these length bytes.
  	that.inflateSyncPoint = function (z) {
  		if (!z || !z.istate || !z.istate.blocks)
  			return Z_STREAM_ERROR;
  		return z.istate.blocks.sync_point();
  	};
  }

  // ZStream

  function ZStream() {
  }

  ZStream.prototype = {
  	inflateInit(bits) {
  		const that = this;
  		that.istate = new Inflate();
  		if (!bits)
  			bits = MAX_BITS;
  		return that.istate.inflateInit(that, bits);
  	},

  	inflate(f) {
  		const that = this;
  		if (!that.istate)
  			return Z_STREAM_ERROR;
  		return that.istate.inflate(that, f);
  	},

  	inflateEnd() {
  		const that = this;
  		if (!that.istate)
  			return Z_STREAM_ERROR;
  		const ret = that.istate.inflateEnd(that);
  		that.istate = null;
  		return ret;
  	},

  	inflateSync() {
  		const that = this;
  		if (!that.istate)
  			return Z_STREAM_ERROR;
  		return that.istate.inflateSync(that);
  	},
  	inflateSetDictionary(dictionary, dictLength) {
  		const that = this;
  		if (!that.istate)
  			return Z_STREAM_ERROR;
  		return that.istate.inflateSetDictionary(that, dictionary, dictLength);
  	},
  	read_byte(start) {
  		const that = this;
  		return that.next_in[start];
  	},
  	read_buf(start, size) {
  		const that = this;
  		return that.next_in.subarray(start, start + size);
  	}
  };

  // Inflater

  function ZipInflate(options) {
  	const that = this;
  	const z = new ZStream();
  	const bufsize = options && options.chunkSize ? Math.floor(options.chunkSize * 2) : 128 * 1024;
  	const flush = Z_NO_FLUSH;
  	const buf = new Uint8Array(bufsize);
  	let nomoreinput = false;

  	z.inflateInit();
  	z.next_out = buf;

  	that.append = function (data, onprogress) {
  		const buffers = [];
  		let err, array, lastIndex = 0, bufferIndex = 0, bufferSize = 0;
  		if (data.length === 0)
  			return;
  		z.next_in_index = 0;
  		z.next_in = data;
  		z.avail_in = data.length;
  		do {
  			z.next_out_index = 0;
  			z.avail_out = bufsize;
  			if ((z.avail_in === 0) && (!nomoreinput)) { // if buffer is empty and more input is available, refill it
  				z.next_in_index = 0;
  				nomoreinput = true;
  			}
  			err = z.inflate(flush);
  			if (nomoreinput && (err === Z_BUF_ERROR)) {
  				if (z.avail_in !== 0)
  					throw new Error("inflating: bad input");
  			} else if (err !== Z_OK && err !== Z_STREAM_END)
  				throw new Error("inflating: " + z.msg);
  			if ((nomoreinput || err === Z_STREAM_END) && (z.avail_in === data.length))
  				throw new Error("inflating: bad input");
  			if (z.next_out_index)
  				if (z.next_out_index === bufsize)
  					buffers.push(new Uint8Array(buf));
  				else
  					buffers.push(buf.slice(0, z.next_out_index));
  			bufferSize += z.next_out_index;
  			if (onprogress && z.next_in_index > 0 && z.next_in_index != lastIndex) {
  				onprogress(z.next_in_index);
  				lastIndex = z.next_in_index;
  			}
  		} while (z.avail_in > 0 || z.avail_out === 0);
  		if (buffers.length > 1) {
  			array = new Uint8Array(bufferSize);
  			buffers.forEach(function (chunk) {
  				array.set(chunk, bufferIndex);
  				bufferIndex += chunk.length;
  			});
  		} else {
  			array = buffers[0] || new Uint8Array();
  		}
  		return array;
  	};
  	that.flush = function () {
  		z.inflateEnd();
  	};
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const MAX_32_BITS = 0xffffffff;
  const MAX_16_BITS = 0xffff;
  const COMPRESSION_METHOD_DEFLATE = 0x08;
  const COMPRESSION_METHOD_STORE = 0x00;
  const COMPRESSION_METHOD_AES = 0x63;

  const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
  const SPLIT_ZIP_FILE_SIGNATURE = 0x08074b50;
  const DATA_DESCRIPTOR_RECORD_SIGNATURE = SPLIT_ZIP_FILE_SIGNATURE;
  const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
  const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;
  const ZIP64_END_OF_CENTRAL_DIR_SIGNATURE = 0x06064b50;
  const ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE = 0x07064b50;
  const END_OF_CENTRAL_DIR_LENGTH = 22;
  const ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH = 20;
  const ZIP64_END_OF_CENTRAL_DIR_LENGTH = 56;
  const ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH = END_OF_CENTRAL_DIR_LENGTH + ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH + ZIP64_END_OF_CENTRAL_DIR_LENGTH;

  const EXTRAFIELD_TYPE_ZIP64 = 0x0001;
  const EXTRAFIELD_TYPE_AES = 0x9901;
  const EXTRAFIELD_TYPE_NTFS = 0x000a;
  const EXTRAFIELD_TYPE_NTFS_TAG1 = 0x0001;
  const EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP = 0x5455;

  const BITFLAG_ENCRYPTED = 0x01;
  const BITFLAG_DATA_DESCRIPTOR = 0x0008;
  const BITFLAG_LANG_ENCODING_FLAG = 0x0800;
  const FILE_ATTR_MSDOS_DIR_MASK = 0x10;

  const VERSION_DEFLATE = 0x14;
  const VERSION_ZIP64 = 0x2D;
  const VERSION_AES = 0x33;

  const DIRECTORY_SIGNATURE = "/";

  const MAX_DATE = new Date(2107, 11, 31);
  const MIN_DATE = new Date(1980, 0, 1);

  const UNDEFINED_VALUE = undefined;
  const UNDEFINED_TYPE$1 = "undefined";
  const FUNCTION_TYPE$1 = "function";

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  class StreamAdapter {

  	constructor(Codec) {
  		return class extends TransformStream {
  			constructor(_format, options) {
  				const codec = new Codec(options);
  				super({
  					transform(chunk, controller) {
  						controller.enqueue(codec.append(chunk));
  					},
  					flush(controller) {
  						const chunk = codec.flush();
  						if (chunk) {
  							controller.enqueue(chunk);
  						}
  					}
  				});
  			}
  		};
  	}
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const MINIMUM_CHUNK_SIZE = 64;
  let maxWorkers = 2;
  try {
  	if (typeof navigator != UNDEFINED_TYPE$1 && navigator.hardwareConcurrency) {
  		maxWorkers = navigator.hardwareConcurrency;
  	}
  } catch (_error) {
  	// ignored
  }
  const DEFAULT_CONFIGURATION = {
  	chunkSize: 512 * 1024,
  	maxWorkers,
  	terminateWorkerTimeout: 5000,
  	useWebWorkers: true,
  	useCompressionStream: true,
  	workerScripts: UNDEFINED_VALUE,
  	CompressionStreamNative: typeof CompressionStream != UNDEFINED_TYPE$1 && CompressionStream,
  	DecompressionStreamNative: typeof DecompressionStream != UNDEFINED_TYPE$1 && DecompressionStream
  };

  const config = Object.assign({}, DEFAULT_CONFIGURATION);

  function getConfiguration() {
  	return config;
  }

  function getChunkSize(config) {
  	return Math.max(config.chunkSize, MINIMUM_CHUNK_SIZE);
  }

  function configure(configuration) {
  	const {
  		baseURL,
  		chunkSize,
  		maxWorkers,
  		terminateWorkerTimeout,
  		useCompressionStream,
  		useWebWorkers,
  		Deflate,
  		Inflate,
  		CompressionStream,
  		DecompressionStream,
  		workerScripts
  	} = configuration;
  	setIfDefined("baseURL", baseURL);
  	setIfDefined("chunkSize", chunkSize);
  	setIfDefined("maxWorkers", maxWorkers);
  	setIfDefined("terminateWorkerTimeout", terminateWorkerTimeout);
  	setIfDefined("useCompressionStream", useCompressionStream);
  	setIfDefined("useWebWorkers", useWebWorkers);
  	if (Deflate) {
  		config.CompressionStream = new StreamAdapter(Deflate);
  	}
  	if (Inflate) {
  		config.DecompressionStream = new StreamAdapter(Inflate);
  	}
  	setIfDefined("CompressionStream", CompressionStream);
  	setIfDefined("DecompressionStream", DecompressionStream);
  	if (workerScripts !== UNDEFINED_VALUE) {
  		const { deflate, inflate } = workerScripts;
  		if (deflate || inflate) {
  			if (!config.workerScripts) {
  				config.workerScripts = {};
  			}
  		}
  		if (deflate) {
  			if (!Array.isArray(deflate)) {
  				throw new Error("workerScripts.deflate must be an array");
  			}
  			config.workerScripts.deflate = deflate;
  		}
  		if (inflate) {
  			if (!Array.isArray(inflate)) {
  				throw new Error("workerScripts.inflate must be an array");
  			}
  			config.workerScripts.inflate = inflate;
  		}
  	}
  }

  function setIfDefined(propertyName, propertyValue) {
  	if (propertyValue !== UNDEFINED_VALUE) {
  		config[propertyName] = propertyValue;
  	}
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const table$1 = {
  	"application": {
  		"andrew-inset": "ez",
  		"annodex": "anx",
  		"atom+xml": "atom",
  		"atomcat+xml": "atomcat",
  		"atomserv+xml": "atomsrv",
  		"bbolin": "lin",
  		"cap": ["cap", "pcap"],
  		"cu-seeme": "cu",
  		"davmount+xml": "davmount",
  		"dsptype": "tsp",
  		"ecmascript": ["es", "ecma"],
  		"futuresplash": "spl",
  		"hta": "hta",
  		"java-archive": "jar",
  		"java-serialized-object": "ser",
  		"java-vm": "class",
  		"javascript": "js",
  		"m3g": "m3g",
  		"mac-binhex40": "hqx",
  		"mathematica": ["nb", "ma", "mb"],
  		"msaccess": "mdb",
  		"msword": ["doc", "dot"],
  		"mxf": "mxf",
  		"oda": "oda",
  		"ogg": "ogx",
  		"pdf": "pdf",
  		"pgp-keys": "key",
  		"pgp-signature": ["asc", "sig"],
  		"pics-rules": "prf",
  		"postscript": ["ps", "ai", "eps", "epsi", "epsf", "eps2", "eps3"],
  		"rar": "rar",
  		"rdf+xml": "rdf",
  		"rss+xml": "rss",
  		"rtf": "rtf",
  		"smil": ["smi", "smil"],
  		"xhtml+xml": ["xhtml", "xht"],
  		"xml": ["xml", "xsl", "xsd"],
  		"xspf+xml": "xspf",
  		"zip": "zip",
  		"vnd.android.package-archive": "apk",
  		"vnd.cinderella": "cdy",
  		"vnd.google-earth.kml+xml": "kml",
  		"vnd.google-earth.kmz": "kmz",
  		"vnd.mozilla.xul+xml": "xul",
  		"vnd.ms-excel": ["xls", "xlb", "xlt", "xlm", "xla", "xlc", "xlw"],
  		"vnd.ms-pki.seccat": "cat",
  		"vnd.ms-pki.stl": "stl",
  		"vnd.ms-powerpoint": ["ppt", "pps", "pot"],
  		"vnd.oasis.opendocument.chart": "odc",
  		"vnd.oasis.opendocument.database": "odb",
  		"vnd.oasis.opendocument.formula": "odf",
  		"vnd.oasis.opendocument.graphics": "odg",
  		"vnd.oasis.opendocument.graphics-template": "otg",
  		"vnd.oasis.opendocument.image": "odi",
  		"vnd.oasis.opendocument.presentation": "odp",
  		"vnd.oasis.opendocument.presentation-template": "otp",
  		"vnd.oasis.opendocument.spreadsheet": "ods",
  		"vnd.oasis.opendocument.spreadsheet-template": "ots",
  		"vnd.oasis.opendocument.text": "odt",
  		"vnd.oasis.opendocument.text-master": "odm",
  		"vnd.oasis.opendocument.text-template": "ott",
  		"vnd.oasis.opendocument.text-web": "oth",
  		"vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  		"vnd.openxmlformats-officedocument.spreadsheetml.template": "xltx",
  		"vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  		"vnd.openxmlformats-officedocument.presentationml.slideshow": "ppsx",
  		"vnd.openxmlformats-officedocument.presentationml.template": "potx",
  		"vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  		"vnd.openxmlformats-officedocument.wordprocessingml.template": "dotx",
  		"vnd.smaf": "mmf",
  		"vnd.stardivision.calc": "sdc",
  		"vnd.stardivision.chart": "sds",
  		"vnd.stardivision.draw": "sda",
  		"vnd.stardivision.impress": "sdd",
  		"vnd.stardivision.math": ["sdf", "smf"],
  		"vnd.stardivision.writer": ["sdw", "vor"],
  		"vnd.stardivision.writer-global": "sgl",
  		"vnd.sun.xml.calc": "sxc",
  		"vnd.sun.xml.calc.template": "stc",
  		"vnd.sun.xml.draw": "sxd",
  		"vnd.sun.xml.draw.template": "std",
  		"vnd.sun.xml.impress": "sxi",
  		"vnd.sun.xml.impress.template": "sti",
  		"vnd.sun.xml.math": "sxm",
  		"vnd.sun.xml.writer": "sxw",
  		"vnd.sun.xml.writer.global": "sxg",
  		"vnd.sun.xml.writer.template": "stw",
  		"vnd.symbian.install": ["sis", "sisx"],
  		"vnd.visio": ["vsd", "vst", "vss", "vsw"],
  		"vnd.wap.wbxml": "wbxml",
  		"vnd.wap.wmlc": "wmlc",
  		"vnd.wap.wmlscriptc": "wmlsc",
  		"vnd.wordperfect": "wpd",
  		"vnd.wordperfect5.1": "wp5",
  		"x-123": "wk",
  		"x-7z-compressed": "7z",
  		"x-abiword": "abw",
  		"x-apple-diskimage": "dmg",
  		"x-bcpio": "bcpio",
  		"x-bittorrent": "torrent",
  		"x-cbr": ["cbr", "cba", "cbt", "cb7"],
  		"x-cbz": "cbz",
  		"x-cdf": ["cdf", "cda"],
  		"x-cdlink": "vcd",
  		"x-chess-pgn": "pgn",
  		"x-cpio": "cpio",
  		"x-csh": "csh",
  		"x-debian-package": ["deb", "udeb"],
  		"x-director": ["dcr", "dir", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"],
  		"x-dms": "dms",
  		"x-doom": "wad",
  		"x-dvi": "dvi",
  		"x-httpd-eruby": "rhtml",
  		"x-font": "pcf.Z",
  		"x-freemind": "mm",
  		"x-gnumeric": "gnumeric",
  		"x-go-sgf": "sgf",
  		"x-graphing-calculator": "gcf",
  		"x-gtar": ["gtar", "taz"],
  		"x-hdf": "hdf",
  		"x-httpd-php": ["phtml", "pht", "php"],
  		"x-httpd-php-source": "phps",
  		"x-httpd-php3": "php3",
  		"x-httpd-php3-preprocessed": "php3p",
  		"x-httpd-php4": "php4",
  		"x-httpd-php5": "php5",
  		"x-ica": "ica",
  		"x-info": "info",
  		"x-internet-signup": ["ins", "isp"],
  		"x-iphone": "iii",
  		"x-iso9660-image": "iso",
  		"x-java-jnlp-file": "jnlp",
  		"x-jmol": "jmz",
  		"x-killustrator": "kil",
  		"x-koan": ["skp", "skd", "skt", "skm"],
  		"x-kpresenter": ["kpr", "kpt"],
  		"x-kword": ["kwd", "kwt"],
  		"x-latex": "latex",
  		"x-lha": "lha",
  		"x-lyx": "lyx",
  		"x-lzh": "lzh",
  		"x-lzx": "lzx",
  		"x-maker": ["frm", "maker", "frame", "fm", "fb", "book", "fbdoc"],
  		"x-ms-wmd": "wmd",
  		"x-ms-wmz": "wmz",
  		"x-msdos-program": ["com", "exe", "bat", "dll"],
  		"x-msi": "msi",
  		"x-netcdf": ["nc", "cdf"],
  		"x-ns-proxy-autoconfig": ["pac", "dat"],
  		"x-nwc": "nwc",
  		"x-object": "o",
  		"x-oz-application": "oza",
  		"x-pkcs7-certreqresp": "p7r",
  		"x-python-code": ["pyc", "pyo"],
  		"x-qgis": ["qgs", "shp", "shx"],
  		"x-quicktimeplayer": "qtl",
  		"x-redhat-package-manager": "rpm",
  		"x-ruby": "rb",
  		"x-sh": "sh",
  		"x-shar": "shar",
  		"x-shockwave-flash": ["swf", "swfl"],
  		"x-silverlight": "scr",
  		"x-stuffit": "sit",
  		"x-sv4cpio": "sv4cpio",
  		"x-sv4crc": "sv4crc",
  		"x-tar": "tar",
  		"x-tcl": "tcl",
  		"x-tex-gf": "gf",
  		"x-tex-pk": "pk",
  		"x-texinfo": ["texinfo", "texi"],
  		"x-trash": ["~", "%", "bak", "old", "sik"],
  		"x-troff": ["t", "tr", "roff"],
  		"x-troff-man": "man",
  		"x-troff-me": "me",
  		"x-troff-ms": "ms",
  		"x-ustar": "ustar",
  		"x-wais-source": "src",
  		"x-wingz": "wz",
  		"x-x509-ca-cert": ["crt", "der", "cer"],
  		"x-xcf": "xcf",
  		"x-xfig": "fig",
  		"x-xpinstall": "xpi",
  		"applixware": "aw",
  		"atomsvc+xml": "atomsvc",
  		"ccxml+xml": "ccxml",
  		"cdmi-capability": "cdmia",
  		"cdmi-container": "cdmic",
  		"cdmi-domain": "cdmid",
  		"cdmi-object": "cdmio",
  		"cdmi-queue": "cdmiq",
  		"docbook+xml": "dbk",
  		"dssc+der": "dssc",
  		"dssc+xml": "xdssc",
  		"emma+xml": "emma",
  		"epub+zip": "epub",
  		"exi": "exi",
  		"font-tdpfr": "pfr",
  		"gml+xml": "gml",
  		"gpx+xml": "gpx",
  		"gxf": "gxf",
  		"hyperstudio": "stk",
  		"inkml+xml": ["ink", "inkml"],
  		"ipfix": "ipfix",
  		"json": "json",
  		"jsonml+json": "jsonml",
  		"lost+xml": "lostxml",
  		"mads+xml": "mads",
  		"marc": "mrc",
  		"marcxml+xml": "mrcx",
  		"mathml+xml": "mathml",
  		"mbox": "mbox",
  		"mediaservercontrol+xml": "mscml",
  		"metalink+xml": "metalink",
  		"metalink4+xml": "meta4",
  		"mets+xml": "mets",
  		"mods+xml": "mods",
  		"mp21": ["m21", "mp21"],
  		"mp4": "mp4s",
  		"oebps-package+xml": "opf",
  		"omdoc+xml": "omdoc",
  		"onenote": ["onetoc", "onetoc2", "onetmp", "onepkg"],
  		"oxps": "oxps",
  		"patch-ops-error+xml": "xer",
  		"pgp-encrypted": "pgp",
  		"pkcs10": "p10",
  		"pkcs7-mime": ["p7m", "p7c"],
  		"pkcs7-signature": "p7s",
  		"pkcs8": "p8",
  		"pkix-attr-cert": "ac",
  		"pkix-crl": "crl",
  		"pkix-pkipath": "pkipath",
  		"pkixcmp": "pki",
  		"pls+xml": "pls",
  		"prs.cww": "cww",
  		"pskc+xml": "pskcxml",
  		"reginfo+xml": "rif",
  		"relax-ng-compact-syntax": "rnc",
  		"resource-lists+xml": "rl",
  		"resource-lists-diff+xml": "rld",
  		"rls-services+xml": "rs",
  		"rpki-ghostbusters": "gbr",
  		"rpki-manifest": "mft",
  		"rpki-roa": "roa",
  		"rsd+xml": "rsd",
  		"sbml+xml": "sbml",
  		"scvp-cv-request": "scq",
  		"scvp-cv-response": "scs",
  		"scvp-vp-request": "spq",
  		"scvp-vp-response": "spp",
  		"sdp": "sdp",
  		"set-payment-initiation": "setpay",
  		"set-registration-initiation": "setreg",
  		"shf+xml": "shf",
  		"sparql-query": "rq",
  		"sparql-results+xml": "srx",
  		"srgs": "gram",
  		"srgs+xml": "grxml",
  		"sru+xml": "sru",
  		"ssdl+xml": "ssdl",
  		"ssml+xml": "ssml",
  		"tei+xml": ["tei", "teicorpus"],
  		"thraud+xml": "tfi",
  		"timestamped-data": "tsd",
  		"vnd.3gpp.pic-bw-large": "plb",
  		"vnd.3gpp.pic-bw-small": "psb",
  		"vnd.3gpp.pic-bw-var": "pvb",
  		"vnd.3gpp2.tcap": "tcap",
  		"vnd.3m.post-it-notes": "pwn",
  		"vnd.accpac.simply.aso": "aso",
  		"vnd.accpac.simply.imp": "imp",
  		"vnd.acucobol": "acu",
  		"vnd.acucorp": ["atc", "acutc"],
  		"vnd.adobe.air-application-installer-package+zip": "air",
  		"vnd.adobe.formscentral.fcdt": "fcdt",
  		"vnd.adobe.fxp": ["fxp", "fxpl"],
  		"vnd.adobe.xdp+xml": "xdp",
  		"vnd.adobe.xfdf": "xfdf",
  		"vnd.ahead.space": "ahead",
  		"vnd.airzip.filesecure.azf": "azf",
  		"vnd.airzip.filesecure.azs": "azs",
  		"vnd.amazon.ebook": "azw",
  		"vnd.americandynamics.acc": "acc",
  		"vnd.amiga.ami": "ami",
  		"vnd.anser-web-certificate-issue-initiation": "cii",
  		"vnd.anser-web-funds-transfer-initiation": "fti",
  		"vnd.antix.game-component": "atx",
  		"vnd.apple.installer+xml": "mpkg",
  		"vnd.apple.mpegurl": "m3u8",
  		"vnd.aristanetworks.swi": "swi",
  		"vnd.astraea-software.iota": "iota",
  		"vnd.audiograph": "aep",
  		"vnd.blueice.multipass": "mpm",
  		"vnd.bmi": "bmi",
  		"vnd.businessobjects": "rep",
  		"vnd.chemdraw+xml": "cdxml",
  		"vnd.chipnuts.karaoke-mmd": "mmd",
  		"vnd.claymore": "cla",
  		"vnd.cloanto.rp9": "rp9",
  		"vnd.clonk.c4group": ["c4g", "c4d", "c4f", "c4p", "c4u"],
  		"vnd.cluetrust.cartomobile-config": "c11amc",
  		"vnd.cluetrust.cartomobile-config-pkg": "c11amz",
  		"vnd.commonspace": "csp",
  		"vnd.contact.cmsg": "cdbcmsg",
  		"vnd.cosmocaller": "cmc",
  		"vnd.crick.clicker": "clkx",
  		"vnd.crick.clicker.keyboard": "clkk",
  		"vnd.crick.clicker.palette": "clkp",
  		"vnd.crick.clicker.template": "clkt",
  		"vnd.crick.clicker.wordbank": "clkw",
  		"vnd.criticaltools.wbs+xml": "wbs",
  		"vnd.ctc-posml": "pml",
  		"vnd.cups-ppd": "ppd",
  		"vnd.curl.car": "car",
  		"vnd.curl.pcurl": "pcurl",
  		"vnd.dart": "dart",
  		"vnd.data-vision.rdz": "rdz",
  		"vnd.dece.data": ["uvf", "uvvf", "uvd", "uvvd"],
  		"vnd.dece.ttml+xml": ["uvt", "uvvt"],
  		"vnd.dece.unspecified": ["uvx", "uvvx"],
  		"vnd.dece.zip": ["uvz", "uvvz"],
  		"vnd.denovo.fcselayout-link": "fe_launch",
  		"vnd.dna": "dna",
  		"vnd.dolby.mlp": "mlp",
  		"vnd.dpgraph": "dpg",
  		"vnd.dreamfactory": "dfac",
  		"vnd.ds-keypoint": "kpxx",
  		"vnd.dvb.ait": "ait",
  		"vnd.dvb.service": "svc",
  		"vnd.dynageo": "geo",
  		"vnd.ecowin.chart": "mag",
  		"vnd.enliven": "nml",
  		"vnd.epson.esf": "esf",
  		"vnd.epson.msf": "msf",
  		"vnd.epson.quickanime": "qam",
  		"vnd.epson.salt": "slt",
  		"vnd.epson.ssf": "ssf",
  		"vnd.eszigno3+xml": ["es3", "et3"],
  		"vnd.ezpix-album": "ez2",
  		"vnd.ezpix-package": "ez3",
  		"vnd.fdf": "fdf",
  		"vnd.fdsn.mseed": "mseed",
  		"vnd.fdsn.seed": ["seed", "dataless"],
  		"vnd.flographit": "gph",
  		"vnd.fluxtime.clip": "ftc",
  		"vnd.framemaker": ["fm", "frame", "maker", "book"],
  		"vnd.frogans.fnc": "fnc",
  		"vnd.frogans.ltf": "ltf",
  		"vnd.fsc.weblaunch": "fsc",
  		"vnd.fujitsu.oasys": "oas",
  		"vnd.fujitsu.oasys2": "oa2",
  		"vnd.fujitsu.oasys3": "oa3",
  		"vnd.fujitsu.oasysgp": "fg5",
  		"vnd.fujitsu.oasysprs": "bh2",
  		"vnd.fujixerox.ddd": "ddd",
  		"vnd.fujixerox.docuworks": "xdw",
  		"vnd.fujixerox.docuworks.binder": "xbd",
  		"vnd.fuzzysheet": "fzs",
  		"vnd.genomatix.tuxedo": "txd",
  		"vnd.geogebra.file": "ggb",
  		"vnd.geogebra.tool": "ggt",
  		"vnd.geometry-explorer": ["gex", "gre"],
  		"vnd.geonext": "gxt",
  		"vnd.geoplan": "g2w",
  		"vnd.geospace": "g3w",
  		"vnd.gmx": "gmx",
  		"vnd.grafeq": ["gqf", "gqs"],
  		"vnd.groove-account": "gac",
  		"vnd.groove-help": "ghf",
  		"vnd.groove-identity-message": "gim",
  		"vnd.groove-injector": "grv",
  		"vnd.groove-tool-message": "gtm",
  		"vnd.groove-tool-template": "tpl",
  		"vnd.groove-vcard": "vcg",
  		"vnd.hal+xml": "hal",
  		"vnd.handheld-entertainment+xml": "zmm",
  		"vnd.hbci": "hbci",
  		"vnd.hhe.lesson-player": "les",
  		"vnd.hp-hpgl": "hpgl",
  		"vnd.hp-hpid": "hpid",
  		"vnd.hp-hps": "hps",
  		"vnd.hp-jlyt": "jlt",
  		"vnd.hp-pcl": "pcl",
  		"vnd.hp-pclxl": "pclxl",
  		"vnd.hydrostatix.sof-data": "sfd-hdstx",
  		"vnd.ibm.minipay": "mpy",
  		"vnd.ibm.modcap": ["afp", "listafp", "list3820"],
  		"vnd.ibm.rights-management": "irm",
  		"vnd.ibm.secure-container": "sc",
  		"vnd.iccprofile": ["icc", "icm"],
  		"vnd.igloader": "igl",
  		"vnd.immervision-ivp": "ivp",
  		"vnd.immervision-ivu": "ivu",
  		"vnd.insors.igm": "igm",
  		"vnd.intercon.formnet": ["xpw", "xpx"],
  		"vnd.intergeo": "i2g",
  		"vnd.intu.qbo": "qbo",
  		"vnd.intu.qfx": "qfx",
  		"vnd.ipunplugged.rcprofile": "rcprofile",
  		"vnd.irepository.package+xml": "irp",
  		"vnd.is-xpr": "xpr",
  		"vnd.isac.fcs": "fcs",
  		"vnd.jam": "jam",
  		"vnd.jcp.javame.midlet-rms": "rms",
  		"vnd.jisp": "jisp",
  		"vnd.joost.joda-archive": "joda",
  		"vnd.kahootz": ["ktz", "ktr"],
  		"vnd.kde.karbon": "karbon",
  		"vnd.kde.kchart": "chrt",
  		"vnd.kde.kformula": "kfo",
  		"vnd.kde.kivio": "flw",
  		"vnd.kde.kontour": "kon",
  		"vnd.kde.kpresenter": ["kpr", "kpt"],
  		"vnd.kde.kspread": "ksp",
  		"vnd.kde.kword": ["kwd", "kwt"],
  		"vnd.kenameaapp": "htke",
  		"vnd.kidspiration": "kia",
  		"vnd.kinar": ["kne", "knp"],
  		"vnd.koan": ["skp", "skd", "skt", "skm"],
  		"vnd.kodak-descriptor": "sse",
  		"vnd.las.las+xml": "lasxml",
  		"vnd.llamagraphics.life-balance.desktop": "lbd",
  		"vnd.llamagraphics.life-balance.exchange+xml": "lbe",
  		"vnd.lotus-1-2-3": "123",
  		"vnd.lotus-approach": "apr",
  		"vnd.lotus-freelance": "pre",
  		"vnd.lotus-notes": "nsf",
  		"vnd.lotus-organizer": "org",
  		"vnd.lotus-screencam": "scm",
  		"vnd.lotus-wordpro": "lwp",
  		"vnd.macports.portpkg": "portpkg",
  		"vnd.mcd": "mcd",
  		"vnd.medcalcdata": "mc1",
  		"vnd.mediastation.cdkey": "cdkey",
  		"vnd.mfer": "mwf",
  		"vnd.mfmp": "mfm",
  		"vnd.micrografx.flo": "flo",
  		"vnd.micrografx.igx": "igx",
  		"vnd.mif": "mif",
  		"vnd.mobius.daf": "daf",
  		"vnd.mobius.dis": "dis",
  		"vnd.mobius.mbk": "mbk",
  		"vnd.mobius.mqy": "mqy",
  		"vnd.mobius.msl": "msl",
  		"vnd.mobius.plc": "plc",
  		"vnd.mobius.txf": "txf",
  		"vnd.mophun.application": "mpn",
  		"vnd.mophun.certificate": "mpc",
  		"vnd.ms-artgalry": "cil",
  		"vnd.ms-cab-compressed": "cab",
  		"vnd.ms-excel.addin.macroenabled.12": "xlam",
  		"vnd.ms-excel.sheet.binary.macroenabled.12": "xlsb",
  		"vnd.ms-excel.sheet.macroenabled.12": "xlsm",
  		"vnd.ms-excel.template.macroenabled.12": "xltm",
  		"vnd.ms-fontobject": "eot",
  		"vnd.ms-htmlhelp": "chm",
  		"vnd.ms-ims": "ims",
  		"vnd.ms-lrm": "lrm",
  		"vnd.ms-officetheme": "thmx",
  		"vnd.ms-powerpoint.addin.macroenabled.12": "ppam",
  		"vnd.ms-powerpoint.presentation.macroenabled.12": "pptm",
  		"vnd.ms-powerpoint.slide.macroenabled.12": "sldm",
  		"vnd.ms-powerpoint.slideshow.macroenabled.12": "ppsm",
  		"vnd.ms-powerpoint.template.macroenabled.12": "potm",
  		"vnd.ms-project": ["mpp", "mpt"],
  		"vnd.ms-word.document.macroenabled.12": "docm",
  		"vnd.ms-word.template.macroenabled.12": "dotm",
  		"vnd.ms-works": ["wps", "wks", "wcm", "wdb"],
  		"vnd.ms-wpl": "wpl",
  		"vnd.ms-xpsdocument": "xps",
  		"vnd.mseq": "mseq",
  		"vnd.musician": "mus",
  		"vnd.muvee.style": "msty",
  		"vnd.mynfc": "taglet",
  		"vnd.neurolanguage.nlu": "nlu",
  		"vnd.nitf": ["ntf", "nitf"],
  		"vnd.noblenet-directory": "nnd",
  		"vnd.noblenet-sealer": "nns",
  		"vnd.noblenet-web": "nnw",
  		"vnd.nokia.n-gage.data": "ngdat",
  		"vnd.nokia.n-gage.symbian.install": "n-gage",
  		"vnd.nokia.radio-preset": "rpst",
  		"vnd.nokia.radio-presets": "rpss",
  		"vnd.novadigm.edm": "edm",
  		"vnd.novadigm.edx": "edx",
  		"vnd.novadigm.ext": "ext",
  		"vnd.oasis.opendocument.chart-template": "otc",
  		"vnd.oasis.opendocument.formula-template": "odft",
  		"vnd.oasis.opendocument.image-template": "oti",
  		"vnd.olpc-sugar": "xo",
  		"vnd.oma.dd2+xml": "dd2",
  		"vnd.openofficeorg.extension": "oxt",
  		"vnd.openxmlformats-officedocument.presentationml.slide": "sldx",
  		"vnd.osgeo.mapguide.package": "mgp",
  		"vnd.osgi.dp": "dp",
  		"vnd.osgi.subsystem": "esa",
  		"vnd.palm": ["pdb", "pqa", "oprc"],
  		"vnd.pawaafile": "paw",
  		"vnd.pg.format": "str",
  		"vnd.pg.osasli": "ei6",
  		"vnd.picsel": "efif",
  		"vnd.pmi.widget": "wg",
  		"vnd.pocketlearn": "plf",
  		"vnd.powerbuilder6": "pbd",
  		"vnd.previewsystems.box": "box",
  		"vnd.proteus.magazine": "mgz",
  		"vnd.publishare-delta-tree": "qps",
  		"vnd.pvi.ptid1": "ptid",
  		"vnd.quark.quarkxpress": ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"],
  		"vnd.realvnc.bed": "bed",
  		"vnd.recordare.musicxml": "mxl",
  		"vnd.recordare.musicxml+xml": "musicxml",
  		"vnd.rig.cryptonote": "cryptonote",
  		"vnd.rn-realmedia": "rm",
  		"vnd.rn-realmedia-vbr": "rmvb",
  		"vnd.route66.link66+xml": "link66",
  		"vnd.sailingtracker.track": "st",
  		"vnd.seemail": "see",
  		"vnd.sema": "sema",
  		"vnd.semd": "semd",
  		"vnd.semf": "semf",
  		"vnd.shana.informed.formdata": "ifm",
  		"vnd.shana.informed.formtemplate": "itp",
  		"vnd.shana.informed.interchange": "iif",
  		"vnd.shana.informed.package": "ipk",
  		"vnd.simtech-mindmapper": ["twd", "twds"],
  		"vnd.smart.teacher": "teacher",
  		"vnd.solent.sdkm+xml": ["sdkm", "sdkd"],
  		"vnd.spotfire.dxp": "dxp",
  		"vnd.spotfire.sfs": "sfs",
  		"vnd.stepmania.package": "smzip",
  		"vnd.stepmania.stepchart": "sm",
  		"vnd.sus-calendar": ["sus", "susp"],
  		"vnd.svd": "svd",
  		"vnd.syncml+xml": "xsm",
  		"vnd.syncml.dm+wbxml": "bdm",
  		"vnd.syncml.dm+xml": "xdm",
  		"vnd.tao.intent-module-archive": "tao",
  		"vnd.tcpdump.pcap": ["pcap", "cap", "dmp"],
  		"vnd.tmobile-livetv": "tmo",
  		"vnd.trid.tpt": "tpt",
  		"vnd.triscape.mxs": "mxs",
  		"vnd.trueapp": "tra",
  		"vnd.ufdl": ["ufd", "ufdl"],
  		"vnd.uiq.theme": "utz",
  		"vnd.umajin": "umj",
  		"vnd.unity": "unityweb",
  		"vnd.uoml+xml": "uoml",
  		"vnd.vcx": "vcx",
  		"vnd.visionary": "vis",
  		"vnd.vsf": "vsf",
  		"vnd.webturbo": "wtb",
  		"vnd.wolfram.player": "nbp",
  		"vnd.wqd": "wqd",
  		"vnd.wt.stf": "stf",
  		"vnd.xara": "xar",
  		"vnd.xfdl": "xfdl",
  		"vnd.yamaha.hv-dic": "hvd",
  		"vnd.yamaha.hv-script": "hvs",
  		"vnd.yamaha.hv-voice": "hvp",
  		"vnd.yamaha.openscoreformat": "osf",
  		"vnd.yamaha.openscoreformat.osfpvg+xml": "osfpvg",
  		"vnd.yamaha.smaf-audio": "saf",
  		"vnd.yamaha.smaf-phrase": "spf",
  		"vnd.yellowriver-custom-menu": "cmp",
  		"vnd.zul": ["zir", "zirz"],
  		"vnd.zzazz.deck+xml": "zaz",
  		"voicexml+xml": "vxml",
  		"widget": "wgt",
  		"winhlp": "hlp",
  		"wsdl+xml": "wsdl",
  		"wspolicy+xml": "wspolicy",
  		"x-ace-compressed": "ace",
  		"x-authorware-bin": ["aab", "x32", "u32", "vox"],
  		"x-authorware-map": "aam",
  		"x-authorware-seg": "aas",
  		"x-blorb": ["blb", "blorb"],
  		"x-bzip": "bz",
  		"x-bzip2": ["bz2", "boz"],
  		"x-cfs-compressed": "cfs",
  		"x-chat": "chat",
  		"x-conference": "nsc",
  		"x-dgc-compressed": "dgc",
  		"x-dtbncx+xml": "ncx",
  		"x-dtbook+xml": "dtb",
  		"x-dtbresource+xml": "res",
  		"x-eva": "eva",
  		"x-font-bdf": "bdf",
  		"x-font-ghostscript": "gsf",
  		"x-font-linux-psf": "psf",
  		"x-font-otf": "otf",
  		"x-font-pcf": "pcf",
  		"x-font-snf": "snf",
  		"x-font-ttf": ["ttf", "ttc"],
  		"x-font-type1": ["pfa", "pfb", "pfm", "afm"],
  		"x-font-woff": "woff",
  		"x-freearc": "arc",
  		"x-gca-compressed": "gca",
  		"x-glulx": "ulx",
  		"x-gramps-xml": "gramps",
  		"x-install-instructions": "install",
  		"x-lzh-compressed": ["lzh", "lha"],
  		"x-mie": "mie",
  		"x-mobipocket-ebook": ["prc", "mobi"],
  		"x-ms-application": "application",
  		"x-ms-shortcut": "lnk",
  		"x-ms-xbap": "xbap",
  		"x-msbinder": "obd",
  		"x-mscardfile": "crd",
  		"x-msclip": "clp",
  		"x-msdownload": ["exe", "dll", "com", "bat", "msi"],
  		"x-msmediaview": ["mvb", "m13", "m14"],
  		"x-msmetafile": ["wmf", "wmz", "emf", "emz"],
  		"x-msmoney": "mny",
  		"x-mspublisher": "pub",
  		"x-msschedule": "scd",
  		"x-msterminal": "trm",
  		"x-mswrite": "wri",
  		"x-nzb": "nzb",
  		"x-pkcs12": ["p12", "pfx"],
  		"x-pkcs7-certificates": ["p7b", "spc"],
  		"x-research-info-systems": "ris",
  		"x-silverlight-app": "xap",
  		"x-sql": "sql",
  		"x-stuffitx": "sitx",
  		"x-subrip": "srt",
  		"x-t3vm-image": "t3",
  		"x-tads": "gam",
  		"x-tex": "tex",
  		"x-tex-tfm": "tfm",
  		"x-tgif": "obj",
  		"x-xliff+xml": "xlf",
  		"x-xz": "xz",
  		"x-zmachine": ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"],
  		"xaml+xml": "xaml",
  		"xcap-diff+xml": "xdf",
  		"xenc+xml": "xenc",
  		"xml-dtd": "dtd",
  		"xop+xml": "xop",
  		"xproc+xml": "xpl",
  		"xslt+xml": "xslt",
  		"xv+xml": ["mxml", "xhvml", "xvml", "xvm"],
  		"yang": "yang",
  		"yin+xml": "yin",
  		"envoy": "evy",
  		"fractals": "fif",
  		"internet-property-stream": "acx",
  		"olescript": "axs",
  		"vnd.ms-outlook": "msg",
  		"vnd.ms-pkicertstore": "sst",
  		"x-compress": "z",
  		"x-compressed": "tgz",
  		"x-gzip": "gz",
  		"x-perfmon": ["pma", "pmc", "pml", "pmr", "pmw"],
  		"x-pkcs7-mime": ["p7c", "p7m"],
  		"ynd.ms-pkipko": "pko"
  	},
  	"audio": {
  		"amr": "amr",
  		"amr-wb": "awb",
  		"annodex": "axa",
  		"basic": ["au", "snd"],
  		"flac": "flac",
  		"midi": ["mid", "midi", "kar", "rmi"],
  		"mpeg": ["mpga", "mpega", "mp2", "mp3", "m4a", "mp2a", "m2a", "m3a"],
  		"mpegurl": "m3u",
  		"ogg": ["oga", "ogg", "spx"],
  		"prs.sid": "sid",
  		"x-aiff": ["aif", "aiff", "aifc"],
  		"x-gsm": "gsm",
  		"x-ms-wma": "wma",
  		"x-ms-wax": "wax",
  		"x-pn-realaudio": "ram",
  		"x-realaudio": "ra",
  		"x-sd2": "sd2",
  		"x-wav": "wav",
  		"adpcm": "adp",
  		"mp4": "mp4a",
  		"s3m": "s3m",
  		"silk": "sil",
  		"vnd.dece.audio": ["uva", "uvva"],
  		"vnd.digital-winds": "eol",
  		"vnd.dra": "dra",
  		"vnd.dts": "dts",
  		"vnd.dts.hd": "dtshd",
  		"vnd.lucent.voice": "lvp",
  		"vnd.ms-playready.media.pya": "pya",
  		"vnd.nuera.ecelp4800": "ecelp4800",
  		"vnd.nuera.ecelp7470": "ecelp7470",
  		"vnd.nuera.ecelp9600": "ecelp9600",
  		"vnd.rip": "rip",
  		"webm": "weba",
  		"x-aac": "aac",
  		"x-caf": "caf",
  		"x-matroska": "mka",
  		"x-pn-realaudio-plugin": "rmp",
  		"xm": "xm",
  		"mid": ["mid", "rmi"]
  	},
  	"chemical": {
  		"x-alchemy": "alc",
  		"x-cache": ["cac", "cache"],
  		"x-cache-csf": "csf",
  		"x-cactvs-binary": ["cbin", "cascii", "ctab"],
  		"x-cdx": "cdx",
  		"x-chem3d": "c3d",
  		"x-cif": "cif",
  		"x-cmdf": "cmdf",
  		"x-cml": "cml",
  		"x-compass": "cpa",
  		"x-crossfire": "bsd",
  		"x-csml": ["csml", "csm"],
  		"x-ctx": "ctx",
  		"x-cxf": ["cxf", "cef"],
  		"x-embl-dl-nucleotide": ["emb", "embl"],
  		"x-gamess-input": ["inp", "gam", "gamin"],
  		"x-gaussian-checkpoint": ["fch", "fchk"],
  		"x-gaussian-cube": "cub",
  		"x-gaussian-input": ["gau", "gjc", "gjf"],
  		"x-gaussian-log": "gal",
  		"x-gcg8-sequence": "gcg",
  		"x-genbank": "gen",
  		"x-hin": "hin",
  		"x-isostar": ["istr", "ist"],
  		"x-jcamp-dx": ["jdx", "dx"],
  		"x-kinemage": "kin",
  		"x-macmolecule": "mcm",
  		"x-macromodel-input": ["mmd", "mmod"],
  		"x-mdl-molfile": "mol",
  		"x-mdl-rdfile": "rd",
  		"x-mdl-rxnfile": "rxn",
  		"x-mdl-sdfile": ["sd", "sdf"],
  		"x-mdl-tgf": "tgf",
  		"x-mmcif": "mcif",
  		"x-mol2": "mol2",
  		"x-molconn-Z": "b",
  		"x-mopac-graph": "gpt",
  		"x-mopac-input": ["mop", "mopcrt", "mpc", "zmt"],
  		"x-mopac-out": "moo",
  		"x-ncbi-asn1": "asn",
  		"x-ncbi-asn1-ascii": ["prt", "ent"],
  		"x-ncbi-asn1-binary": ["val", "aso"],
  		"x-pdb": ["pdb", "ent"],
  		"x-rosdal": "ros",
  		"x-swissprot": "sw",
  		"x-vamas-iso14976": "vms",
  		"x-vmd": "vmd",
  		"x-xtel": "xtel",
  		"x-xyz": "xyz"
  	},
  	"image": {
  		"gif": "gif",
  		"ief": "ief",
  		"jpeg": ["jpeg", "jpg", "jpe"],
  		"pcx": "pcx",
  		"png": "png",
  		"svg+xml": ["svg", "svgz"],
  		"tiff": ["tiff", "tif"],
  		"vnd.djvu": ["djvu", "djv"],
  		"vnd.wap.wbmp": "wbmp",
  		"x-canon-cr2": "cr2",
  		"x-canon-crw": "crw",
  		"x-cmu-raster": "ras",
  		"x-coreldraw": "cdr",
  		"x-coreldrawpattern": "pat",
  		"x-coreldrawtemplate": "cdt",
  		"x-corelphotopaint": "cpt",
  		"x-epson-erf": "erf",
  		"x-icon": "ico",
  		"x-jg": "art",
  		"x-jng": "jng",
  		"x-nikon-nef": "nef",
  		"x-olympus-orf": "orf",
  		"x-photoshop": "psd",
  		"x-portable-anymap": "pnm",
  		"x-portable-bitmap": "pbm",
  		"x-portable-graymap": "pgm",
  		"x-portable-pixmap": "ppm",
  		"x-rgb": "rgb",
  		"x-xbitmap": "xbm",
  		"x-xpixmap": "xpm",
  		"x-xwindowdump": "xwd",
  		"bmp": "bmp",
  		"cgm": "cgm",
  		"g3fax": "g3",
  		"ktx": "ktx",
  		"prs.btif": "btif",
  		"sgi": "sgi",
  		"vnd.dece.graphic": ["uvi", "uvvi", "uvg", "uvvg"],
  		"vnd.dwg": "dwg",
  		"vnd.dxf": "dxf",
  		"vnd.fastbidsheet": "fbs",
  		"vnd.fpx": "fpx",
  		"vnd.fst": "fst",
  		"vnd.fujixerox.edmics-mmr": "mmr",
  		"vnd.fujixerox.edmics-rlc": "rlc",
  		"vnd.ms-modi": "mdi",
  		"vnd.ms-photo": "wdp",
  		"vnd.net-fpx": "npx",
  		"vnd.xiff": "xif",
  		"webp": "webp",
  		"x-3ds": "3ds",
  		"x-cmx": "cmx",
  		"x-freehand": ["fh", "fhc", "fh4", "fh5", "fh7"],
  		"x-pict": ["pic", "pct"],
  		"x-tga": "tga",
  		"cis-cod": "cod",
  		"pipeg": "jfif"
  	},
  	"message": {
  		"rfc822": ["eml", "mime", "mht", "mhtml", "nws"]
  	},
  	"model": {
  		"iges": ["igs", "iges"],
  		"mesh": ["msh", "mesh", "silo"],
  		"vrml": ["wrl", "vrml"],
  		"x3d+vrml": ["x3dv", "x3dvz"],
  		"x3d+xml": ["x3d", "x3dz"],
  		"x3d+binary": ["x3db", "x3dbz"],
  		"vnd.collada+xml": "dae",
  		"vnd.dwf": "dwf",
  		"vnd.gdl": "gdl",
  		"vnd.gtw": "gtw",
  		"vnd.mts": "mts",
  		"vnd.vtu": "vtu"
  	},
  	"text": {
  		"cache-manifest": ["manifest", "appcache"],
  		"calendar": ["ics", "icz", "ifb"],
  		"css": "css",
  		"csv": "csv",
  		"h323": "323",
  		"html": ["html", "htm", "shtml", "stm"],
  		"iuls": "uls",
  		"mathml": "mml",
  		"plain": ["txt", "text", "brf", "conf", "def", "list", "log", "in", "bas"],
  		"richtext": "rtx",
  		"scriptlet": ["sct", "wsc"],
  		"texmacs": ["tm", "ts"],
  		"tab-separated-values": "tsv",
  		"vnd.sun.j2me.app-descriptor": "jad",
  		"vnd.wap.wml": "wml",
  		"vnd.wap.wmlscript": "wmls",
  		"x-bibtex": "bib",
  		"x-boo": "boo",
  		"x-c++hdr": ["h++", "hpp", "hxx", "hh"],
  		"x-c++src": ["c++", "cpp", "cxx", "cc"],
  		"x-component": "htc",
  		"x-dsrc": "d",
  		"x-diff": ["diff", "patch"],
  		"x-haskell": "hs",
  		"x-java": "java",
  		"x-literate-haskell": "lhs",
  		"x-moc": "moc",
  		"x-pascal": ["p", "pas"],
  		"x-pcs-gcd": "gcd",
  		"x-perl": ["pl", "pm"],
  		"x-python": "py",
  		"x-scala": "scala",
  		"x-setext": "etx",
  		"x-tcl": ["tcl", "tk"],
  		"x-tex": ["tex", "ltx", "sty", "cls"],
  		"x-vcalendar": "vcs",
  		"x-vcard": "vcf",
  		"n3": "n3",
  		"prs.lines.tag": "dsc",
  		"sgml": ["sgml", "sgm"],
  		"troff": ["t", "tr", "roff", "man", "me", "ms"],
  		"turtle": "ttl",
  		"uri-list": ["uri", "uris", "urls"],
  		"vcard": "vcard",
  		"vnd.curl": "curl",
  		"vnd.curl.dcurl": "dcurl",
  		"vnd.curl.scurl": "scurl",
  		"vnd.curl.mcurl": "mcurl",
  		"vnd.dvb.subtitle": "sub",
  		"vnd.fly": "fly",
  		"vnd.fmi.flexstor": "flx",
  		"vnd.graphviz": "gv",
  		"vnd.in3d.3dml": "3dml",
  		"vnd.in3d.spot": "spot",
  		"x-asm": ["s", "asm"],
  		"x-c": ["c", "cc", "cxx", "cpp", "h", "hh", "dic"],
  		"x-fortran": ["f", "for", "f77", "f90"],
  		"x-opml": "opml",
  		"x-nfo": "nfo",
  		"x-sfv": "sfv",
  		"x-uuencode": "uu",
  		"webviewhtml": "htt"
  	},
  	"video": {
  		"avif": ".avif",
  		"3gpp": "3gp",
  		"annodex": "axv",
  		"dl": "dl",
  		"dv": ["dif", "dv"],
  		"fli": "fli",
  		"gl": "gl",
  		"mpeg": ["mpeg", "mpg", "mpe", "m1v", "m2v", "mp2", "mpa", "mpv2"],
  		"mp4": ["mp4", "mp4v", "mpg4"],
  		"quicktime": ["qt", "mov"],
  		"ogg": "ogv",
  		"vnd.mpegurl": ["mxu", "m4u"],
  		"x-flv": "flv",
  		"x-la-asf": ["lsf", "lsx"],
  		"x-mng": "mng",
  		"x-ms-asf": ["asf", "asx", "asr"],
  		"x-ms-wm": "wm",
  		"x-ms-wmv": "wmv",
  		"x-ms-wmx": "wmx",
  		"x-ms-wvx": "wvx",
  		"x-msvideo": "avi",
  		"x-sgi-movie": "movie",
  		"x-matroska": ["mpv", "mkv", "mk3d", "mks"],
  		"3gpp2": "3g2",
  		"h261": "h261",
  		"h263": "h263",
  		"h264": "h264",
  		"jpeg": "jpgv",
  		"jpm": ["jpm", "jpgm"],
  		"mj2": ["mj2", "mjp2"],
  		"vnd.dece.hd": ["uvh", "uvvh"],
  		"vnd.dece.mobile": ["uvm", "uvvm"],
  		"vnd.dece.pd": ["uvp", "uvvp"],
  		"vnd.dece.sd": ["uvs", "uvvs"],
  		"vnd.dece.video": ["uvv", "uvvv"],
  		"vnd.dvb.file": "dvb",
  		"vnd.fvt": "fvt",
  		"vnd.ms-playready.media.pyv": "pyv",
  		"vnd.uvvu.mp4": ["uvu", "uvvu"],
  		"vnd.vivo": "viv",
  		"webm": "webm",
  		"x-f4v": "f4v",
  		"x-m4v": "m4v",
  		"x-ms-vob": "vob",
  		"x-smv": "smv"
  	},
  	"x-conference": {
  		"x-cooltalk": "ice"
  	},
  	"x-world": {
  		"x-vrml": ["vrm", "vrml", "wrl", "flr", "wrz", "xaf", "xof"]
  	}
  };

  (() => {
  	const mimeTypes = {};
  	for (const type in table$1) {
  		// eslint-disable-next-line no-prototype-builtins
  		if (table$1.hasOwnProperty(type)) {
  			for (const subtype in table$1[type]) {
  				// eslint-disable-next-line no-prototype-builtins
  				if (table$1[type].hasOwnProperty(subtype)) {
  					const value = table$1[type][subtype];
  					if (typeof value == "string") {
  						mimeTypes[value] = type + "/" + subtype;
  					} else {
  						for (let indexMimeType = 0; indexMimeType < value.length; indexMimeType++) {
  							mimeTypes[value[indexMimeType]] = type + "/" + subtype;
  						}
  					}
  				}
  			}
  		}
  	}
  	return mimeTypes;
  })();

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const table = [];
  for (let i = 0; i < 256; i++) {
  	let t = i;
  	for (let j = 0; j < 8; j++) {
  		if (t & 1) {
  			t = (t >>> 1) ^ 0xEDB88320;
  		} else {
  			t = t >>> 1;
  		}
  	}
  	table[i] = t;
  }

  class Crc32 {

  	constructor(crc) {
  		this.crc = crc || -1;
  	}

  	append(data) {
  		let crc = this.crc | 0;
  		for (let offset = 0, length = data.length | 0; offset < length; offset++) {
  			crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF];
  		}
  		this.crc = crc;
  	}

  	get() {
  		return ~this.crc;
  	}
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  class Crc32Stream extends TransformStream {

  	constructor() {
  		const crc32 = new Crc32();
  		super({
  			transform(chunk) {
  				crc32.append(chunk);
  			},
  			flush(controller) {
  				const value = new Uint8Array(4);
  				const dataView = new DataView(value.buffer);
  				dataView.setUint32(0, crc32.get());
  				controller.enqueue(value);
  			}
  		});
  	}
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  function encodeText(value) {
  	if (typeof TextEncoder == "undefined") {
  		value = unescape(encodeURIComponent(value));
  		const result = new Uint8Array(value.length);
  		for (let i = 0; i < result.length; i++) {
  			result[i] = value.charCodeAt(i);
  		}
  		return result;
  	} else {
  		return new TextEncoder().encode(value);
  	}
  }

  // Derived from https://github.com/xqdoo00o/jszip/blob/master/lib/sjcl.js and https://github.com/bitwiseshiftleft/sjcl

  // deno-lint-ignore-file no-this-alias

  /*
   * SJCL is open. You can use, modify and redistribute it under a BSD
   * license or under the GNU GPL, version 2.0.
   */

  /** @fileOverview Javascript cryptography implementation.
   *
   * Crush to remove comments, shorten variable names and
   * generally reduce transmission size.
   *
   * @author Emily Stark
   * @author Mike Hamburg
   * @author Dan Boneh
   */

  /*jslint indent: 2, bitwise: false, nomen: false, plusplus: false, white: false, regexp: false */

  /** @fileOverview Arrays of bits, encoded as arrays of Numbers.
   *
   * @author Emily Stark
   * @author Mike Hamburg
   * @author Dan Boneh
   */

  /**
   * Arrays of bits, encoded as arrays of Numbers.
   * @namespace
   * @description
   * <p>
   * These objects are the currency accepted by SJCL's crypto functions.
   * </p>
   *
   * <p>
   * Most of our crypto primitives operate on arrays of 4-byte words internally,
   * but many of them can take arguments that are not a multiple of 4 bytes.
   * This library encodes arrays of bits (whose size need not be a multiple of 8
   * bits) as arrays of 32-bit words.  The bits are packed, big-endian, into an
   * array of words, 32 bits at a time.  Since the words are double-precision
   * floating point numbers, they fit some extra data.  We use this (in a private,
   * possibly-changing manner) to encode the number of bits actually  present
   * in the last word of the array.
   * </p>
   *
   * <p>
   * Because bitwise ops clear this out-of-band data, these arrays can be passed
   * to ciphers like AES which want arrays of words.
   * </p>
   */
  const bitArray = {
  	/**
  	 * Concatenate two bit arrays.
  	 * @param {bitArray} a1 The first array.
  	 * @param {bitArray} a2 The second array.
  	 * @return {bitArray} The concatenation of a1 and a2.
  	 */
  	concat(a1, a2) {
  		if (a1.length === 0 || a2.length === 0) {
  			return a1.concat(a2);
  		}

  		const last = a1[a1.length - 1], shift = bitArray.getPartial(last);
  		if (shift === 32) {
  			return a1.concat(a2);
  		} else {
  			return bitArray._shiftRight(a2, shift, last | 0, a1.slice(0, a1.length - 1));
  		}
  	},

  	/**
  	 * Find the length of an array of bits.
  	 * @param {bitArray} a The array.
  	 * @return {Number} The length of a, in bits.
  	 */
  	bitLength(a) {
  		const l = a.length;
  		if (l === 0) {
  			return 0;
  		}
  		const x = a[l - 1];
  		return (l - 1) * 32 + bitArray.getPartial(x);
  	},

  	/**
  	 * Truncate an array.
  	 * @param {bitArray} a The array.
  	 * @param {Number} len The length to truncate to, in bits.
  	 * @return {bitArray} A new array, truncated to len bits.
  	 */
  	clamp(a, len) {
  		if (a.length * 32 < len) {
  			return a;
  		}
  		a = a.slice(0, Math.ceil(len / 32));
  		const l = a.length;
  		len = len & 31;
  		if (l > 0 && len) {
  			a[l - 1] = bitArray.partial(len, a[l - 1] & 0x80000000 >> (len - 1), 1);
  		}
  		return a;
  	},

  	/**
  	 * Make a partial word for a bit array.
  	 * @param {Number} len The number of bits in the word.
  	 * @param {Number} x The bits.
  	 * @param {Number} [_end=0] Pass 1 if x has already been shifted to the high side.
  	 * @return {Number} The partial word.
  	 */
  	partial(len, x, _end) {
  		if (len === 32) {
  			return x;
  		}
  		return (_end ? x | 0 : x << (32 - len)) + len * 0x10000000000;
  	},

  	/**
  	 * Get the number of bits used by a partial word.
  	 * @param {Number} x The partial word.
  	 * @return {Number} The number of bits used by the partial word.
  	 */
  	getPartial(x) {
  		return Math.round(x / 0x10000000000) || 32;
  	},

  	/** Shift an array right.
  	 * @param {bitArray} a The array to shift.
  	 * @param {Number} shift The number of bits to shift.
  	 * @param {Number} [carry=0] A byte to carry in
  	 * @param {bitArray} [out=[]] An array to prepend to the output.
  	 * @private
  	 */
  	_shiftRight(a, shift, carry, out) {
  		if (out === undefined) {
  			out = [];
  		}

  		for (; shift >= 32; shift -= 32) {
  			out.push(carry);
  			carry = 0;
  		}
  		if (shift === 0) {
  			return out.concat(a);
  		}

  		for (let i = 0; i < a.length; i++) {
  			out.push(carry | a[i] >>> shift);
  			carry = a[i] << (32 - shift);
  		}
  		const last2 = a.length ? a[a.length - 1] : 0;
  		const shift2 = bitArray.getPartial(last2);
  		out.push(bitArray.partial(shift + shift2 & 31, (shift + shift2 > 32) ? carry : out.pop(), 1));
  		return out;
  	}
  };

  /** @fileOverview Bit array codec implementations.
   *
   * @author Emily Stark
   * @author Mike Hamburg
   * @author Dan Boneh
   */

  /**
   * Arrays of bytes
   * @namespace
   */
  const codec = {
  	bytes: {
  		/** Convert from a bitArray to an array of bytes. */
  		fromBits(arr) {
  			const bl = bitArray.bitLength(arr);
  			const byteLength = bl / 8;
  			const out = new Uint8Array(byteLength);
  			let tmp;
  			for (let i = 0; i < byteLength; i++) {
  				if ((i & 3) === 0) {
  					tmp = arr[i / 4];
  				}
  				out[i] = tmp >>> 24;
  				tmp <<= 8;
  			}
  			return out;
  		},
  		/** Convert from an array of bytes to a bitArray. */
  		toBits(bytes) {
  			const out = [];
  			let i;
  			let tmp = 0;
  			for (i = 0; i < bytes.length; i++) {
  				tmp = tmp << 8 | bytes[i];
  				if ((i & 3) === 3) {
  					out.push(tmp);
  					tmp = 0;
  				}
  			}
  			if (i & 3) {
  				out.push(bitArray.partial(8 * (i & 3), tmp));
  			}
  			return out;
  		}
  	}
  };

  const hash$2 = {};

  /**
   * Context for a SHA-1 operation in progress.
   * @constructor
   */
  hash$2.sha1 = class {
  	constructor(hash) {
  		const sha1 = this;
  		/**
  		 * The hash's block size, in bits.
  		 * @constant
  		 */
  		sha1.blockSize = 512;
  		/**
  		 * The SHA-1 initialization vector.
  		 * @private
  		 */
  		sha1._init = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
  		/**
  		 * The SHA-1 hash key.
  		 * @private
  		 */
  		sha1._key = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];
  		if (hash) {
  			sha1._h = hash._h.slice(0);
  			sha1._buffer = hash._buffer.slice(0);
  			sha1._length = hash._length;
  		} else {
  			sha1.reset();
  		}
  	}

  	/**
  	 * Reset the hash state.
  	 * @return this
  	 */
  	reset() {
  		const sha1 = this;
  		sha1._h = sha1._init.slice(0);
  		sha1._buffer = [];
  		sha1._length = 0;
  		return sha1;
  	}

  	/**
  	 * Input several words to the hash.
  	 * @param {bitArray|String} data the data to hash.
  	 * @return this
  	 */
  	update(data) {
  		const sha1 = this;
  		if (typeof data === "string") {
  			data = codec.utf8String.toBits(data);
  		}
  		const b = sha1._buffer = bitArray.concat(sha1._buffer, data);
  		const ol = sha1._length;
  		const nl = sha1._length = ol + bitArray.bitLength(data);
  		if (nl > 9007199254740991) {
  			throw new Error("Cannot hash more than 2^53 - 1 bits");
  		}
  		const c = new Uint32Array(b);
  		let j = 0;
  		for (let i = sha1.blockSize + ol - ((sha1.blockSize + ol) & (sha1.blockSize - 1)); i <= nl;
  			i += sha1.blockSize) {
  			sha1._block(c.subarray(16 * j, 16 * (j + 1)));
  			j += 1;
  		}
  		b.splice(0, 16 * j);
  		return sha1;
  	}

  	/**
  	 * Complete hashing and output the hash value.
  	 * @return {bitArray} The hash value, an array of 5 big-endian words. TODO
  	 */
  	finalize() {
  		const sha1 = this;
  		let b = sha1._buffer;
  		const h = sha1._h;

  		// Round out and push the buffer
  		b = bitArray.concat(b, [bitArray.partial(1, 1)]);
  		// Round out the buffer to a multiple of 16 words, less the 2 length words.
  		for (let i = b.length + 2; i & 15; i++) {
  			b.push(0);
  		}

  		// append the length
  		b.push(Math.floor(sha1._length / 0x100000000));
  		b.push(sha1._length | 0);

  		while (b.length) {
  			sha1._block(b.splice(0, 16));
  		}

  		sha1.reset();
  		return h;
  	}

  	/**
  	 * The SHA-1 logical functions f(0), f(1), ..., f(79).
  	 * @private
  	 */
  	_f(t, b, c, d) {
  		if (t <= 19) {
  			return (b & c) | (~b & d);
  		} else if (t <= 39) {
  			return b ^ c ^ d;
  		} else if (t <= 59) {
  			return (b & c) | (b & d) | (c & d);
  		} else if (t <= 79) {
  			return b ^ c ^ d;
  		}
  	}

  	/**
  	 * Circular left-shift operator.
  	 * @private
  	 */
  	_S(n, x) {
  		return (x << n) | (x >>> 32 - n);
  	}

  	/**
  	 * Perform one cycle of SHA-1.
  	 * @param {Uint32Array|bitArray} words one block of words.
  	 * @private
  	 */
  	_block(words) {
  		const sha1 = this;
  		const h = sha1._h;
  		// When words is passed to _block, it has 16 elements. SHA1 _block
  		// function extends words with new elements (at the end there are 80 elements). 
  		// The problem is that if we use Uint32Array instead of Array, 
  		// the length of Uint32Array cannot be changed. Thus, we replace words with a 
  		// normal Array here.
  		const w = Array(80); // do not use Uint32Array here as the instantiation is slower
  		for (let j = 0; j < 16; j++) {
  			w[j] = words[j];
  		}

  		let a = h[0];
  		let b = h[1];
  		let c = h[2];
  		let d = h[3];
  		let e = h[4];

  		for (let t = 0; t <= 79; t++) {
  			if (t >= 16) {
  				w[t] = sha1._S(1, w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]);
  			}
  			const tmp = (sha1._S(5, a) + sha1._f(t, b, c, d) + e + w[t] +
  				sha1._key[Math.floor(t / 20)]) | 0;
  			e = d;
  			d = c;
  			c = sha1._S(30, b);
  			b = a;
  			a = tmp;
  		}

  		h[0] = (h[0] + a) | 0;
  		h[1] = (h[1] + b) | 0;
  		h[2] = (h[2] + c) | 0;
  		h[3] = (h[3] + d) | 0;
  		h[4] = (h[4] + e) | 0;
  	}
  };

  /** @fileOverview Low-level AES implementation.
   *
   * This file contains a low-level implementation of AES, optimized for
   * size and for efficiency on several browsers.  It is based on
   * OpenSSL's aes_core.c, a public-domain implementation by Vincent
   * Rijmen, Antoon Bosselaers and Paulo Barreto.
   *
   * An older version of this implementation is available in the public
   * domain, but this one is (c) Emily Stark, Mike Hamburg, Dan Boneh,
   * Stanford University 2008-2010 and BSD-licensed for liability
   * reasons.
   *
   * @author Emily Stark
   * @author Mike Hamburg
   * @author Dan Boneh
   */

  const cipher = {};

  /**
   * Schedule out an AES key for both encryption and decryption.  This
   * is a low-level class.  Use a cipher mode to do bulk encryption.
   *
   * @constructor
   * @param {Array} key The key as an array of 4, 6 or 8 words.
   */
  cipher.aes = class {
  	constructor(key) {
  		/**
  		 * The expanded S-box and inverse S-box tables.  These will be computed
  		 * on the client so that we don't have to send them down the wire.
  		 *
  		 * There are two tables, _tables[0] is for encryption and
  		 * _tables[1] is for decryption.
  		 *
  		 * The first 4 sub-tables are the expanded S-box with MixColumns.  The
  		 * last (_tables[01][4]) is the S-box itself.
  		 *
  		 * @private
  		 */
  		const aes = this;
  		aes._tables = [[[], [], [], [], []], [[], [], [], [], []]];

  		if (!aes._tables[0][0][0]) {
  			aes._precompute();
  		}

  		const sbox = aes._tables[0][4];
  		const decTable = aes._tables[1];
  		const keyLen = key.length;

  		let i, encKey, decKey, rcon = 1;

  		if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
  			throw new Error("invalid aes key size");
  		}

  		aes._key = [encKey = key.slice(0), decKey = []];

  		// schedule encryption keys
  		for (i = keyLen; i < 4 * keyLen + 28; i++) {
  			let tmp = encKey[i - 1];

  			// apply sbox
  			if (i % keyLen === 0 || (keyLen === 8 && i % keyLen === 4)) {
  				tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255];

  				// shift rows and add rcon
  				if (i % keyLen === 0) {
  					tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
  					rcon = rcon << 1 ^ (rcon >> 7) * 283;
  				}
  			}

  			encKey[i] = encKey[i - keyLen] ^ tmp;
  		}

  		// schedule decryption keys
  		for (let j = 0; i; j++, i--) {
  			const tmp = encKey[j & 3 ? i : i - 4];
  			if (i <= 4 || j < 4) {
  				decKey[j] = tmp;
  			} else {
  				decKey[j] = decTable[0][sbox[tmp >>> 24]] ^
  					decTable[1][sbox[tmp >> 16 & 255]] ^
  					decTable[2][sbox[tmp >> 8 & 255]] ^
  					decTable[3][sbox[tmp & 255]];
  			}
  		}
  	}
  	// public
  	/* Something like this might appear here eventually
  	name: "AES",
  	blockSize: 4,
  	keySizes: [4,6,8],
  	*/

  	/**
  	 * Encrypt an array of 4 big-endian words.
  	 * @param {Array} data The plaintext.
  	 * @return {Array} The ciphertext.
  	 */
  	encrypt(data) {
  		return this._crypt(data, 0);
  	}

  	/**
  	 * Decrypt an array of 4 big-endian words.
  	 * @param {Array} data The ciphertext.
  	 * @return {Array} The plaintext.
  	 */
  	decrypt(data) {
  		return this._crypt(data, 1);
  	}

  	/**
  	 * Expand the S-box tables.
  	 *
  	 * @private
  	 */
  	_precompute() {
  		const encTable = this._tables[0];
  		const decTable = this._tables[1];
  		const sbox = encTable[4];
  		const sboxInv = decTable[4];
  		const d = [];
  		const th = [];
  		let xInv, x2, x4, x8;

  		// Compute double and third tables
  		for (let i = 0; i < 256; i++) {
  			th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i;
  		}

  		for (let x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
  			// Compute sbox
  			let s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
  			s = s >> 8 ^ s & 255 ^ 99;
  			sbox[x] = s;
  			sboxInv[s] = x;

  			// Compute MixColumns
  			x8 = d[x4 = d[x2 = d[x]]];
  			let tDec = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
  			let tEnc = d[s] * 0x101 ^ s * 0x1010100;

  			for (let i = 0; i < 4; i++) {
  				encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
  				decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8;
  			}
  		}

  		// Compactify.  Considerable speedup on Firefox.
  		for (let i = 0; i < 5; i++) {
  			encTable[i] = encTable[i].slice(0);
  			decTable[i] = decTable[i].slice(0);
  		}
  	}

  	/**
  	 * Encryption and decryption core.
  	 * @param {Array} input Four words to be encrypted or decrypted.
  	 * @param dir The direction, 0 for encrypt and 1 for decrypt.
  	 * @return {Array} The four encrypted or decrypted words.
  	 * @private
  	 */
  	_crypt(input, dir) {
  		if (input.length !== 4) {
  			throw new Error("invalid aes block size");
  		}

  		const key = this._key[dir];

  		const nInnerRounds = key.length / 4 - 2;
  		const out = [0, 0, 0, 0];
  		const table = this._tables[dir];

  		// load up the tables
  		const t0 = table[0];
  		const t1 = table[1];
  		const t2 = table[2];
  		const t3 = table[3];
  		const sbox = table[4];

  		// state variables a,b,c,d are loaded with pre-whitened data
  		let a = input[0] ^ key[0];
  		let b = input[dir ? 3 : 1] ^ key[1];
  		let c = input[2] ^ key[2];
  		let d = input[dir ? 1 : 3] ^ key[3];
  		let kIndex = 4;
  		let a2, b2, c2;

  		// Inner rounds.  Cribbed from OpenSSL.
  		for (let i = 0; i < nInnerRounds; i++) {
  			a2 = t0[a >>> 24] ^ t1[b >> 16 & 255] ^ t2[c >> 8 & 255] ^ t3[d & 255] ^ key[kIndex];
  			b2 = t0[b >>> 24] ^ t1[c >> 16 & 255] ^ t2[d >> 8 & 255] ^ t3[a & 255] ^ key[kIndex + 1];
  			c2 = t0[c >>> 24] ^ t1[d >> 16 & 255] ^ t2[a >> 8 & 255] ^ t3[b & 255] ^ key[kIndex + 2];
  			d = t0[d >>> 24] ^ t1[a >> 16 & 255] ^ t2[b >> 8 & 255] ^ t3[c & 255] ^ key[kIndex + 3];
  			kIndex += 4;
  			a = a2; b = b2; c = c2;
  		}

  		// Last round.
  		for (let i = 0; i < 4; i++) {
  			out[dir ? 3 & -i : i] =
  				sbox[a >>> 24] << 24 ^
  				sbox[b >> 16 & 255] << 16 ^
  				sbox[c >> 8 & 255] << 8 ^
  				sbox[d & 255] ^
  				key[kIndex++];
  			a2 = a; a = b; b = c; c = d; d = a2;
  		}

  		return out;
  	}
  };

  /**
   * Random values
   * @namespace
   */
  const random = {
  	/** 
  	 * Generate random words with pure js, cryptographically not as strong & safe as native implementation.
  	 * @param {TypedArray} typedArray The array to fill.
  	 * @return {TypedArray} The random values.
  	 */
  	getRandomValues(typedArray) {
  		const words = new Uint32Array(typedArray.buffer);
  		const r = (m_w) => {
  			let m_z = 0x3ade68b1;
  			const mask = 0xffffffff;
  			return function () {
  				m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 0x10)) & mask;
  				m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 0x10)) & mask;
  				const result = ((((m_z << 0x10) + m_w) & mask) / 0x100000000) + .5;
  				return result * (Math.random() > .5 ? 1 : -1);
  			};
  		};
  		for (let i = 0, rcache; i < typedArray.length; i += 4) {
  			const _r = r((rcache || Math.random()) * 0x100000000);
  			rcache = _r() * 0x3ade67b7;
  			words[i / 4] = (_r() * 0x100000000) | 0;
  		}
  		return typedArray;
  	}
  };

  /** @fileOverview CTR mode implementation.
   *
   * Special thanks to Roy Nicholson for pointing out a bug in our
   * implementation.
   *
   * @author Emily Stark
   * @author Mike Hamburg
   * @author Dan Boneh
   */

  /** Brian Gladman's CTR Mode.
  * @constructor
  * @param {Object} _prf The aes instance to generate key.
  * @param {bitArray} _iv The iv for ctr mode, it must be 128 bits.
  */

  const mode = {};

  /**
   * Brian Gladman's CTR Mode.
   * @namespace
   */
  mode.ctrGladman = class {
  	constructor(prf, iv) {
  		this._prf = prf;
  		this._initIv = iv;
  		this._iv = iv;
  	}

  	reset() {
  		this._iv = this._initIv;
  	}

  	/** Input some data to calculate.
  	 * @param {bitArray} data the data to process, it must be intergral multiple of 128 bits unless it's the last.
  	 */
  	update(data) {
  		return this.calculate(this._prf, data, this._iv);
  	}

  	incWord(word) {
  		if (((word >> 24) & 0xff) === 0xff) { //overflow
  			let b1 = (word >> 16) & 0xff;
  			let b2 = (word >> 8) & 0xff;
  			let b3 = word & 0xff;

  			if (b1 === 0xff) { // overflow b1   
  				b1 = 0;
  				if (b2 === 0xff) {
  					b2 = 0;
  					if (b3 === 0xff) {
  						b3 = 0;
  					} else {
  						++b3;
  					}
  				} else {
  					++b2;
  				}
  			} else {
  				++b1;
  			}

  			word = 0;
  			word += (b1 << 16);
  			word += (b2 << 8);
  			word += b3;
  		} else {
  			word += (0x01 << 24);
  		}
  		return word;
  	}

  	incCounter(counter) {
  		if ((counter[0] = this.incWord(counter[0])) === 0) {
  			// encr_data in fileenc.c from  Dr Brian Gladman's counts only with DWORD j < 8
  			counter[1] = this.incWord(counter[1]);
  		}
  	}

  	calculate(prf, data, iv) {
  		let l;
  		if (!(l = data.length)) {
  			return [];
  		}
  		const bl = bitArray.bitLength(data);
  		for (let i = 0; i < l; i += 4) {
  			this.incCounter(iv);
  			const e = prf.encrypt(iv);
  			data[i] ^= e[0];
  			data[i + 1] ^= e[1];
  			data[i + 2] ^= e[2];
  			data[i + 3] ^= e[3];
  		}
  		return bitArray.clamp(data, bl);
  	}
  };

  const misc = {
  	importKey(password) {
  		return new misc.hmacSha1(codec.bytes.toBits(password));
  	},
  	pbkdf2(prf, salt, count, length) {
  		count = count || 10000;
  		if (length < 0 || count < 0) {
  			throw new Error("invalid params to pbkdf2");
  		}
  		const byteLength = ((length >> 5) + 1) << 2;
  		let u, ui, i, j, k;
  		const arrayBuffer = new ArrayBuffer(byteLength);
  		const out = new DataView(arrayBuffer);
  		let outLength = 0;
  		const b = bitArray;
  		salt = codec.bytes.toBits(salt);
  		for (k = 1; outLength < (byteLength || 1); k++) {
  			u = ui = prf.encrypt(b.concat(salt, [k]));
  			for (i = 1; i < count; i++) {
  				ui = prf.encrypt(ui);
  				for (j = 0; j < ui.length; j++) {
  					u[j] ^= ui[j];
  				}
  			}
  			for (i = 0; outLength < (byteLength || 1) && i < u.length; i++) {
  				out.setInt32(outLength, u[i]);
  				outLength += 4;
  			}
  		}
  		return arrayBuffer.slice(0, length / 8);
  	}
  };

  /** @fileOverview HMAC implementation.
   *
   * @author Emily Stark
   * @author Mike Hamburg
   * @author Dan Boneh
   */

  /** HMAC with the specified hash function.
   * @constructor
   * @param {bitArray} key the key for HMAC.
   * @param {Object} [Hash=hash.sha1] The hash function to use.
   */
  misc.hmacSha1 = class {

  	constructor(key) {
  		const hmac = this;
  		const Hash = hmac._hash = hash$2.sha1;
  		const exKey = [[], []];
  		hmac._baseHash = [new Hash(), new Hash()];
  		const bs = hmac._baseHash[0].blockSize / 32;

  		if (key.length > bs) {
  			key = Hash.hash(key);
  		}

  		for (let i = 0; i < bs; i++) {
  			exKey[0][i] = key[i] ^ 0x36363636;
  			exKey[1][i] = key[i] ^ 0x5C5C5C5C;
  		}

  		hmac._baseHash[0].update(exKey[0]);
  		hmac._baseHash[1].update(exKey[1]);
  		hmac._resultHash = new Hash(hmac._baseHash[0]);
  	}
  	reset() {
  		const hmac = this;
  		hmac._resultHash = new hmac._hash(hmac._baseHash[0]);
  		hmac._updated = false;
  	}

  	update(data) {
  		const hmac = this;
  		hmac._updated = true;
  		hmac._resultHash.update(data);
  	}

  	digest() {
  		const hmac = this;
  		const w = hmac._resultHash.finalize();
  		const result = new (hmac._hash)(hmac._baseHash[1]).update(w).finalize();

  		hmac.reset();

  		return result;
  	}

  	encrypt(data) {
  		if (!this._updated) {
  			this.update(data);
  			return this.digest(data);
  		} else {
  			throw new Error("encrypt on already updated hmac called!");
  		}
  	}
  };

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  /* global crypto */

  const GET_RANDOM_VALUES_SUPPORTED = typeof crypto != "undefined" && typeof crypto.getRandomValues == "function";

  const ERR_INVALID_PASSWORD = "Invalid password";
  const ERR_INVALID_SIGNATURE = "Invalid signature";

  function getRandomValues(array) {
  	if (GET_RANDOM_VALUES_SUPPORTED) {
  		return crypto.getRandomValues(array);
  	} else {
  		return random.getRandomValues(array);
  	}
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const BLOCK_LENGTH = 16;
  const RAW_FORMAT = "raw";
  const PBKDF2_ALGORITHM = { name: "PBKDF2" };
  const HASH_ALGORITHM = { name: "HMAC" };
  const HASH_FUNCTION = "SHA-1";
  const BASE_KEY_ALGORITHM = Object.assign({ hash: HASH_ALGORITHM }, PBKDF2_ALGORITHM);
  const DERIVED_BITS_ALGORITHM = Object.assign({ iterations: 1000, hash: { name: HASH_FUNCTION } }, PBKDF2_ALGORITHM);
  const DERIVED_BITS_USAGE = ["deriveBits"];
  const SALT_LENGTH = [8, 12, 16];
  const KEY_LENGTH = [16, 24, 32];
  const SIGNATURE_LENGTH = 10;
  const COUNTER_DEFAULT_VALUE = [0, 0, 0, 0];
  const UNDEFINED_TYPE = "undefined";
  const FUNCTION_TYPE = "function";
  // deno-lint-ignore valid-typeof
  const CRYPTO_API_SUPPORTED = typeof crypto != UNDEFINED_TYPE;
  const subtle = CRYPTO_API_SUPPORTED && crypto.subtle;
  const SUBTLE_API_SUPPORTED = CRYPTO_API_SUPPORTED && typeof subtle != UNDEFINED_TYPE;
  const codecBytes = codec.bytes;
  const Aes = cipher.aes;
  const CtrGladman = mode.ctrGladman;
  const HmacSha1 = misc.hmacSha1;

  let IMPORT_KEY_SUPPORTED = CRYPTO_API_SUPPORTED && SUBTLE_API_SUPPORTED && typeof subtle.importKey == FUNCTION_TYPE;
  let DERIVE_BITS_SUPPORTED = CRYPTO_API_SUPPORTED && SUBTLE_API_SUPPORTED && typeof subtle.deriveBits == FUNCTION_TYPE;

  class AESDecryptionStream extends TransformStream {

  	constructor({ password, signed, encryptionStrength }) {
  		super({
  			start() {
  				Object.assign(this, {
  					ready: new Promise(resolve => this.resolveReady = resolve),
  					password,
  					signed,
  					strength: encryptionStrength - 1,
  					pending: new Uint8Array()
  				});
  			},
  			async transform(chunk, controller) {
  				const aesCrypto = this;
  				const {
  					password,
  					strength,
  					resolveReady,
  					ready
  				} = aesCrypto;
  				if (password) {
  					await createDecryptionKeys(aesCrypto, strength, password, subarray(chunk, 0, SALT_LENGTH[strength] + 2));
  					chunk = subarray(chunk, SALT_LENGTH[strength] + 2);
  					resolveReady();
  				} else {
  					await ready;
  				}
  				const output = new Uint8Array(chunk.length - SIGNATURE_LENGTH - ((chunk.length - SIGNATURE_LENGTH) % BLOCK_LENGTH));
  				controller.enqueue(append$1(aesCrypto, chunk, output, 0, SIGNATURE_LENGTH, true));
  			},
  			async flush(controller) {
  				const {
  					signed,
  					ctr,
  					hmac,
  					pending,
  					ready
  				} = this;
  				await ready;
  				const chunkToDecrypt = subarray(pending, 0, pending.length - SIGNATURE_LENGTH);
  				const originalSignature = subarray(pending, pending.length - SIGNATURE_LENGTH);
  				let decryptedChunkArray = new Uint8Array();
  				if (chunkToDecrypt.length) {
  					const encryptedChunk = toBits(codecBytes, chunkToDecrypt);
  					hmac.update(encryptedChunk);
  					const decryptedChunk = ctr.update(encryptedChunk);
  					decryptedChunkArray = fromBits(codecBytes, decryptedChunk);
  				}
  				if (signed) {
  					const signature = subarray(fromBits(codecBytes, hmac.digest()), 0, SIGNATURE_LENGTH);
  					for (let indexSignature = 0; indexSignature < SIGNATURE_LENGTH; indexSignature++) {
  						if (signature[indexSignature] != originalSignature[indexSignature]) {
  							throw new Error(ERR_INVALID_SIGNATURE);
  						}
  					}
  				}
  				controller.enqueue(decryptedChunkArray);
  			}
  		});
  	}
  }

  class AESEncryptionStream extends TransformStream {

  	constructor({ password, encryptionStrength }) {
  		// deno-lint-ignore prefer-const
  		let stream;
  		super({
  			start() {
  				Object.assign(this, {
  					ready: new Promise(resolve => this.resolveReady = resolve),
  					password,
  					strength: encryptionStrength - 1,
  					pending: new Uint8Array()
  				});
  			},
  			async transform(chunk, controller) {
  				const aesCrypto = this;
  				const {
  					password,
  					strength,
  					resolveReady,
  					ready
  				} = aesCrypto;
  				let preamble = new Uint8Array();
  				if (password) {
  					preamble = await createEncryptionKeys(aesCrypto, strength, password);
  					resolveReady();
  				} else {
  					await ready;
  				}
  				const output = new Uint8Array(preamble.length + chunk.length - (chunk.length % BLOCK_LENGTH));
  				output.set(preamble, 0);
  				controller.enqueue(append$1(aesCrypto, chunk, output, preamble.length, 0));
  			},
  			async flush(controller) {
  				const {
  					ctr,
  					hmac,
  					pending,
  					ready
  				} = this;
  				await ready;
  				let encryptedChunkArray = new Uint8Array();
  				if (pending.length) {
  					const encryptedChunk = ctr.update(toBits(codecBytes, pending));
  					hmac.update(encryptedChunk);
  					encryptedChunkArray = fromBits(codecBytes, encryptedChunk);
  				}
  				stream.signature = fromBits(codecBytes, hmac.digest()).slice(0, SIGNATURE_LENGTH);
  				controller.enqueue(concat(encryptedChunkArray, stream.signature));
  			}
  		});
  		stream = this;
  	}
  }

  function append$1(aesCrypto, input, output, paddingStart, paddingEnd, verifySignature) {
  	const {
  		ctr,
  		hmac,
  		pending
  	} = aesCrypto;
  	const inputLength = input.length - paddingEnd;
  	if (pending.length) {
  		input = concat(pending, input);
  		output = expand(output, inputLength - (inputLength % BLOCK_LENGTH));
  	}
  	let offset;
  	for (offset = 0; offset <= inputLength - BLOCK_LENGTH; offset += BLOCK_LENGTH) {
  		const inputChunk = toBits(codecBytes, subarray(input, offset, offset + BLOCK_LENGTH));
  		if (verifySignature) {
  			hmac.update(inputChunk);
  		}
  		const outputChunk = ctr.update(inputChunk);
  		if (!verifySignature) {
  			hmac.update(outputChunk);
  		}
  		output.set(fromBits(codecBytes, outputChunk), offset + paddingStart);
  	}
  	aesCrypto.pending = subarray(input, offset);
  	return output;
  }

  async function createDecryptionKeys(decrypt, strength, password, preamble) {
  	const passwordVerificationKey = await createKeys$1(decrypt, strength, password, subarray(preamble, 0, SALT_LENGTH[strength]));
  	const passwordVerification = subarray(preamble, SALT_LENGTH[strength]);
  	if (passwordVerificationKey[0] != passwordVerification[0] || passwordVerificationKey[1] != passwordVerification[1]) {
  		throw new Error(ERR_INVALID_PASSWORD);
  	}
  }

  async function createEncryptionKeys(encrypt, strength, password) {
  	const salt = getRandomValues(new Uint8Array(SALT_LENGTH[strength]));
  	const passwordVerification = await createKeys$1(encrypt, strength, password, salt);
  	return concat(salt, passwordVerification);
  }

  async function createKeys$1(aesCrypto, strength, password, salt) {
  	aesCrypto.password = null;
  	const encodedPassword = encodeText(password);
  	const baseKey = await importKey(RAW_FORMAT, encodedPassword, BASE_KEY_ALGORITHM, false, DERIVED_BITS_USAGE);
  	const derivedBits = await deriveBits(Object.assign({ salt }, DERIVED_BITS_ALGORITHM), baseKey, 8 * ((KEY_LENGTH[strength] * 2) + 2));
  	const compositeKey = new Uint8Array(derivedBits);
  	const key = toBits(codecBytes, subarray(compositeKey, 0, KEY_LENGTH[strength]));
  	const authentication = toBits(codecBytes, subarray(compositeKey, KEY_LENGTH[strength], KEY_LENGTH[strength] * 2));
  	const passwordVerification = subarray(compositeKey, KEY_LENGTH[strength] * 2);
  	Object.assign(aesCrypto, {
  		keys: {
  			key,
  			authentication,
  			passwordVerification
  		},
  		ctr: new CtrGladman(new Aes(key), Array.from(COUNTER_DEFAULT_VALUE)),
  		hmac: new HmacSha1(authentication)
  	});
  	return passwordVerification;
  }

  async function importKey(format, password, algorithm, extractable, keyUsages) {
  	if (IMPORT_KEY_SUPPORTED) {
  		try {
  			return await subtle.importKey(format, password, algorithm, extractable, keyUsages);
  		} catch (_error) {
  			IMPORT_KEY_SUPPORTED = false;
  			return misc.importKey(password);
  		}
  	} else {
  		return misc.importKey(password);
  	}
  }

  async function deriveBits(algorithm, baseKey, length) {
  	if (DERIVE_BITS_SUPPORTED) {
  		try {
  			return await subtle.deriveBits(algorithm, baseKey, length);
  		} catch (_error) {
  			DERIVE_BITS_SUPPORTED = false;
  			return misc.pbkdf2(baseKey, algorithm.salt, DERIVED_BITS_ALGORITHM.iterations, length);
  		}
  	} else {
  		return misc.pbkdf2(baseKey, algorithm.salt, DERIVED_BITS_ALGORITHM.iterations, length);
  	}
  }

  function concat(leftArray, rightArray) {
  	let array = leftArray;
  	if (leftArray.length + rightArray.length) {
  		array = new Uint8Array(leftArray.length + rightArray.length);
  		array.set(leftArray, 0);
  		array.set(rightArray, leftArray.length);
  	}
  	return array;
  }

  function expand(inputArray, length) {
  	if (length && length > inputArray.length) {
  		const array = inputArray;
  		inputArray = new Uint8Array(length);
  		inputArray.set(array, 0);
  	}
  	return inputArray;
  }

  function subarray(array, begin, end) {
  	return array.subarray(begin, end);
  }

  function fromBits(codecBytes, chunk) {
  	return codecBytes.fromBits(chunk);
  }
  function toBits(codecBytes, chunk) {
  	return codecBytes.toBits(chunk);
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const HEADER_LENGTH = 12;

  class ZipCryptoDecryptionStream extends TransformStream {

  	constructor({ password, passwordVerification }) {
  		super({
  			start() {
  				Object.assign(this, {
  					password,
  					passwordVerification
  				});
  				createKeys(this, password);
  			},
  			transform(chunk, controller) {
  				const zipCrypto = this;
  				if (zipCrypto.password) {
  					const decryptedHeader = decrypt(zipCrypto, chunk.subarray(0, HEADER_LENGTH));
  					zipCrypto.password = null;
  					if (decryptedHeader[HEADER_LENGTH - 1] != zipCrypto.passwordVerification) {
  						throw new Error(ERR_INVALID_PASSWORD);
  					}
  					chunk = chunk.subarray(HEADER_LENGTH);
  				}
  				controller.enqueue(decrypt(zipCrypto, chunk));
  			}
  		});
  	}
  }

  class ZipCryptoEncryptionStream extends TransformStream {

  	constructor({ password, passwordVerification }) {
  		super({
  			start() {
  				Object.assign(this, {
  					password,
  					passwordVerification
  				});
  				createKeys(this, password);
  			},
  			transform(chunk, controller) {
  				const zipCrypto = this;
  				let output;
  				let offset;
  				if (zipCrypto.password) {
  					zipCrypto.password = null;
  					const header = getRandomValues(new Uint8Array(HEADER_LENGTH));
  					header[HEADER_LENGTH - 1] = zipCrypto.passwordVerification;
  					output = new Uint8Array(chunk.length + header.length);
  					output.set(encrypt(zipCrypto, header), 0);
  					offset = HEADER_LENGTH;
  				} else {
  					output = new Uint8Array(chunk.length);
  					offset = 0;
  				}
  				output.set(encrypt(zipCrypto, chunk), offset);
  				controller.enqueue(output);
  			}
  		});
  	}
  }

  function decrypt(target, input) {
  	const output = new Uint8Array(input.length);
  	for (let index = 0; index < input.length; index++) {
  		output[index] = getByte(target) ^ input[index];
  		updateKeys(target, output[index]);
  	}
  	return output;
  }

  function encrypt(target, input) {
  	const output = new Uint8Array(input.length);
  	for (let index = 0; index < input.length; index++) {
  		output[index] = getByte(target) ^ input[index];
  		updateKeys(target, input[index]);
  	}
  	return output;
  }

  function createKeys(target, password) {
  	const keys = [0x12345678, 0x23456789, 0x34567890];
  	Object.assign(target, {
  		keys,
  		crcKey0: new Crc32(keys[0]),
  		crcKey2: new Crc32(keys[2]),
  	});
  	for (let index = 0; index < password.length; index++) {
  		updateKeys(target, password.charCodeAt(index));
  	}
  }

  function updateKeys(target, byte) {
  	let [key0, key1, key2] = target.keys;
  	target.crcKey0.append([byte]);
  	key0 = ~target.crcKey0.get();
  	key1 = getInt32(Math.imul(getInt32(key1 + getInt8(key0)), 134775813) + 1);
  	target.crcKey2.append([key1 >>> 24]);
  	key2 = ~target.crcKey2.get();
  	target.keys = [key0, key1, key2];
  }

  function getByte(target) {
  	const temp = target.keys[2] | 2;
  	return getInt8(Math.imul(temp, (temp ^ 1)) >>> 8);
  }

  function getInt8(number) {
  	return number & 0xFF;
  }

  function getInt32(number) {
  	return number & 0xFFFFFFFF;
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const COMPRESSION_FORMAT = "deflate-raw";

  class DeflateStream extends TransformStream {

  	constructor(options, { chunkSize, CompressionStream, CompressionStreamNative }) {
  		super({});
  		const { compressed, encrypted, useCompressionStream, zipCrypto, signed, level } = options;
  		const stream = this;
  		let crc32Stream, encryptionStream;
  		let readable = filterEmptyChunks(super.readable);
  		if ((!encrypted || zipCrypto) && signed) {
  			[readable, crc32Stream] = readable.tee();
  			crc32Stream = pipeThrough(crc32Stream, new Crc32Stream());
  		}
  		if (compressed) {
  			readable = pipeThroughCommpressionStream(readable, useCompressionStream, { level, chunkSize }, CompressionStreamNative, CompressionStream);
  		}
  		if (encrypted) {
  			if (zipCrypto) {
  				readable = pipeThrough(readable, new ZipCryptoEncryptionStream(options));
  			} else {
  				encryptionStream = new AESEncryptionStream(options);
  				readable = pipeThrough(readable, encryptionStream);
  			}
  		}
  		setReadable(stream, readable, async () => {
  			let signature;
  			if (encrypted && !zipCrypto) {
  				signature = encryptionStream.signature;
  			}
  			if ((!encrypted || zipCrypto) && signed) {
  				signature = await crc32Stream.getReader().read();
  				signature = new DataView(signature.value.buffer).getUint32(0);
  			}
  			stream.signature = signature;
  		});
  	}
  }

  class InflateStream extends TransformStream {

  	constructor(options, { chunkSize, DecompressionStream, DecompressionStreamNative }) {
  		super({});
  		const { zipCrypto, encrypted, signed, signature, compressed, useCompressionStream } = options;
  		let crc32Stream, decryptionStream;
  		let readable = filterEmptyChunks(super.readable);
  		if (encrypted) {
  			if (zipCrypto) {
  				readable = pipeThrough(readable, new ZipCryptoDecryptionStream(options));
  			} else {
  				decryptionStream = new AESDecryptionStream(options);
  				readable = pipeThrough(readable, decryptionStream);
  			}
  		}
  		if (compressed) {
  			readable = pipeThroughCommpressionStream(readable, useCompressionStream, { chunkSize }, DecompressionStreamNative, DecompressionStream);
  		}
  		if ((!encrypted || zipCrypto) && signed) {
  			[readable, crc32Stream] = readable.tee();
  			crc32Stream = pipeThrough(crc32Stream, new Crc32Stream());
  		}
  		setReadable(this, readable, async () => {
  			if ((!encrypted || zipCrypto) && signed) {
  				const streamSignature = await crc32Stream.getReader().read();
  				const dataViewSignature = new DataView(streamSignature.value.buffer);
  				if (signature != dataViewSignature.getUint32(0, false)) {
  					throw new Error(ERR_INVALID_SIGNATURE);
  				}
  			}
  		});
  	}
  }

  function filterEmptyChunks(readable) {
  	return pipeThrough(readable, new TransformStream({
  		transform(chunk, controller) {
  			if (chunk && chunk.length) {
  				controller.enqueue(chunk);
  			}
  		}
  	}));
  }

  function setReadable(stream, readable, flush) {
  	readable = pipeThrough(readable, new TransformStream({ flush }));
  	Object.defineProperty(stream, "readable", {
  		get() {
  			return readable;
  		}
  	});
  }

  function pipeThroughCommpressionStream(readable, useCompressionStream, options, CodecStreamNative, CodecStream) {
  	try {
  		const CompressionStream = useCompressionStream && CodecStreamNative ? CodecStreamNative : CodecStream;
  		readable = pipeThrough(readable, new CompressionStream(COMPRESSION_FORMAT, options));
  	} catch (error) {
  		if (useCompressionStream) {
  			readable = pipeThrough(readable, new CodecStream(COMPRESSION_FORMAT, options));
  		} else {
  			throw error;
  		}
  	}
  	return readable;
  }

  function pipeThrough(readable, transformStream) {
  	return readable.pipeThrough(transformStream);
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const MESSAGE_EVENT_TYPE = "message";
  const MESSAGE_START = "start";
  const MESSAGE_PULL = "pull";
  const MESSAGE_DATA = "data";
  const MESSAGE_ACK_DATA = "ack";
  const MESSAGE_CLOSE = "close";
  const CODEC_DEFLATE = "deflate";
  const CODEC_INFLATE = "inflate";

  class CodecStream extends TransformStream {

  	constructor(options, config) {
  		super({});
  		const codec = this;
  		const { codecType } = options;
  		let Stream;
  		if (codecType.startsWith(CODEC_DEFLATE)) {
  			Stream = DeflateStream;
  		} else if (codecType.startsWith(CODEC_INFLATE)) {
  			Stream = InflateStream;
  		}
  		let size = 0;
  		const stream = new Stream(options, config);
  		const readable = super.readable;
  		const transformStream = new TransformStream({
  			transform(chunk, controller) {
  				if (chunk && chunk.length) {
  					size += chunk.length;
  					controller.enqueue(chunk);
  				}
  			},
  			flush() {
  				const { signature } = stream;
  				Object.assign(codec, {
  					signature,
  					size
  				});
  			}
  		});
  		Object.defineProperty(codec, "readable", {
  			get() {
  				return readable.pipeThrough(stream).pipeThrough(transformStream);
  			}
  		});
  	}
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  // deno-lint-ignore valid-typeof
  const WEB_WORKERS_SUPPORTED = typeof Worker != UNDEFINED_TYPE$1;

  class CodecWorker {

  	constructor(workerData, { readable, writable }, { options, config, streamOptions, useWebWorkers, transferStreams, scripts }, onTaskFinished) {
  		const { signal } = streamOptions;
  		Object.assign(workerData, {
  			busy: true,
  			readable: readable.pipeThrough(new ProgressWatcherStream(readable, streamOptions, config), { signal }),
  			writable,
  			options: Object.assign({}, options),
  			scripts,
  			transferStreams,
  			terminate() {
  				const { worker, busy } = workerData;
  				if (worker && !busy) {
  					worker.terminate();
  					workerData.interface = null;
  				}
  			},
  			onTaskFinished() {
  				workerData.busy = false;
  				onTaskFinished(workerData);
  			}
  		});
  		return (useWebWorkers && WEB_WORKERS_SUPPORTED ? createWebWorkerInterface : createWorkerInterface)(workerData, config);
  	}
  }

  class ProgressWatcherStream extends TransformStream {

  	constructor(readableSource, { onstart, onprogress, size, onend }, { chunkSize }) {
  		let chunkOffset = 0;
  		super({
  			start() {
  				if (onstart) {
  					callHandler(onstart, size);
  				}
  			},
  			async transform(chunk, controller) {
  				chunkOffset += chunk.length;
  				if (onprogress) {
  					await callHandler(onprogress, chunkOffset, size);
  				}
  				controller.enqueue(chunk);
  			},
  			flush() {
  				readableSource.size = chunkOffset;
  				if (onend) {
  					callHandler(onend, chunkOffset);
  				}
  			}
  		}, { highWaterMark: 1, size: () => chunkSize });
  	}
  }

  async function callHandler(handler, ...parameters) {
  	try {
  		await handler(...parameters);
  	} catch (_error) {
  		// ignored
  	}
  }

  function createWorkerInterface(workerData, config) {
  	return {
  		run: () => runWorker$1(workerData, config)
  	};
  }

  function createWebWorkerInterface(workerData, { baseURL, chunkSize }) {
  	if (!workerData.interface) {
  		Object.assign(workerData, {
  			worker: getWebWorker(workerData.scripts[0], baseURL, workerData),
  			interface: {
  				run: () => runWebWorker(workerData, { chunkSize })
  			}
  		});
  	}
  	return workerData.interface;
  }

  async function runWorker$1({ options, readable, writable, onTaskFinished }, config) {
  	const codecStream = new CodecStream(options, config);
  	try {
  		await readable.pipeThrough(codecStream).pipeTo(writable, { preventClose: true, preventAbort: true });
  		const {
  			signature,
  			size
  		} = codecStream;
  		return {
  			signature,
  			size
  		};
  	} finally {
  		onTaskFinished();
  	}
  }

  async function runWebWorker(workerData, config) {
  	let resolveResult, rejectResult;
  	const result = new Promise((resolve, reject) => {
  		resolveResult = resolve;
  		rejectResult = reject;
  	});
  	Object.assign(workerData, {
  		reader: null,
  		writer: null,
  		resolveResult,
  		rejectResult,
  		result
  	});
  	const { readable, options, scripts } = workerData;
  	const { writable, closed } = watchClosedStream(workerData.writable);
  	const streamsTransferred = sendMessage({
  		type: MESSAGE_START,
  		scripts: scripts.slice(1),
  		options,
  		config,
  		readable,
  		writable
  	}, workerData);
  	if (!streamsTransferred) {
  		Object.assign(workerData, {
  			reader: readable.getReader(),
  			writer: writable.getWriter()
  		});
  	}
  	const resultValue = await result;
  	try {
  		await writable.close();
  	} catch (_error) {
  		// ignored
  	}
  	await closed;
  	return resultValue;
  }

  function watchClosedStream(writableSource) {
  	const writer = writableSource.getWriter();
  	let resolveStreamClosed;
  	const closed = new Promise(resolve => resolveStreamClosed = resolve);
  	const writable = new WritableStream({
  		async write(chunk) {
  			await writer.ready;
  			await writer.write(chunk);
  		},
  		close() {
  			writer.releaseLock();
  			resolveStreamClosed();
  		},
  		abort(reason) {
  			return writer.abort(reason);
  		}
  	});
  	return { writable, closed };
  }

  let classicWorkersSupported = true;
  let transferStreamsSupported = true;

  function getWebWorker(url, baseURL, workerData) {
  	const workerOptions = { type: "module" };
  	let scriptUrl, worker;
  	// deno-lint-ignore valid-typeof
  	if (typeof url == FUNCTION_TYPE$1) {
  		url = url();
  	}
  	try {
  		scriptUrl = new URL(url, baseURL);
  	} catch (_error) {
  		scriptUrl = url;
  	}
  	if (classicWorkersSupported) {
  		try {
  			worker = new Worker(scriptUrl);
  		} catch (_error) {
  			classicWorkersSupported = false;
  			worker = new Worker(scriptUrl, workerOptions);
  		}
  	} else {
  		worker = new Worker(scriptUrl, workerOptions);
  	}
  	worker.addEventListener(MESSAGE_EVENT_TYPE, event => onMessage(event, workerData));
  	return worker;
  }

  function sendMessage(message, { worker, writer, onTaskFinished, transferStreams }) {
  	try {
  		let { value, readable, writable } = message;
  		const transferables = [];
  		if (value) {
  			const { buffer, length } = value;
  			if (length != buffer.byteLength) {
  				value = new Uint8Array(value);
  			}
  			message.value = value.buffer;
  			transferables.push(message.value);
  		}
  		if (transferStreams && transferStreamsSupported) {
  			if (readable) {
  				transferables.push(readable);
  			}
  			if (writable) {
  				transferables.push(writable);
  			}
  		} else {
  			message.readable = message.writable = null;
  		}
  		if (transferables.length) {
  			try {
  				worker.postMessage(message, transferables);
  				return true;
  			} catch (_error) {
  				transferStreamsSupported = false;
  				message.readable = message.writable = null;
  				worker.postMessage(message);
  			}
  		} else {
  			worker.postMessage(message);
  		}
  	} catch (error) {
  		if (writer) {
  			writer.releaseLock();
  		}
  		onTaskFinished();
  		throw error;
  	}
  }

  async function onMessage({ data }, workerData) {
  	const { type, value, messageId, result, error } = data;
  	const { reader, writer, resolveResult, rejectResult, onTaskFinished } = workerData;
  	try {
  		if (error) {
  			const { message, stack, code, name } = error;
  			const responseError = new Error(message);
  			Object.assign(responseError, { stack, code, name });
  			close(responseError);
  		} else {
  			if (type == MESSAGE_PULL) {
  				const { value, done } = await reader.read();
  				sendMessage({ type: MESSAGE_DATA, value, done, messageId }, workerData);
  			}
  			if (type == MESSAGE_DATA) {
  				await writer.ready;
  				await writer.write(new Uint8Array(value));
  				sendMessage({ type: MESSAGE_ACK_DATA, messageId }, workerData);
  			}
  			if (type == MESSAGE_CLOSE) {
  				close(null, result);
  			}
  		}
  	} catch (error) {
  		close(error);
  	}

  	function close(error, result) {
  		if (error) {
  			rejectResult(error);
  		} else {
  			resolveResult(result);
  		}
  		if (writer) {
  			writer.releaseLock();
  		}
  		onTaskFinished();
  	}
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  let pool = [];
  const pendingRequests = [];

  let indexWorker = 0;

  async function runWorker(stream, workerOptions) {
  	const { options, config } = workerOptions;
  	const { transferStreams, useWebWorkers, useCompressionStream, codecType, compressed, signed, encrypted } = options;
  	const { workerScripts, maxWorkers, terminateWorkerTimeout } = config;
  	workerOptions.transferStreams = transferStreams || transferStreams === UNDEFINED_VALUE;
  	const streamCopy = !compressed && !signed && !encrypted && !workerOptions.transferStreams;
  	workerOptions.useWebWorkers = !streamCopy && (useWebWorkers || (useWebWorkers === UNDEFINED_VALUE && config.useWebWorkers));
  	workerOptions.scripts = workerOptions.useWebWorkers && workerScripts ? workerScripts[codecType] : [];
  	options.useCompressionStream = useCompressionStream || (useCompressionStream === UNDEFINED_VALUE && config.useCompressionStream);
  	let worker;
  	const workerData = pool.find(workerData => !workerData.busy);
  	if (workerData) {
  		clearTerminateTimeout(workerData);
  		worker = new CodecWorker(workerData, stream, workerOptions, onTaskFinished);
  	} else if (pool.length < maxWorkers) {
  		const workerData = { indexWorker };
  		indexWorker++;
  		pool.push(workerData);
  		worker = new CodecWorker(workerData, stream, workerOptions, onTaskFinished);
  	} else {
  		worker = await new Promise(resolve => pendingRequests.push({ resolve, stream, workerOptions }));
  	}
  	return worker.run();

  	function onTaskFinished(workerData) {
  		if (pendingRequests.length) {
  			const [{ resolve, stream, workerOptions }] = pendingRequests.splice(0, 1);
  			resolve(new CodecWorker(workerData, stream, workerOptions, onTaskFinished));
  		} else if (workerData.worker) {
  			clearTerminateTimeout(workerData);
  			if (Number.isFinite(terminateWorkerTimeout) && terminateWorkerTimeout >= 0) {
  				workerData.terminateTimeout = setTimeout(() => {
  					pool = pool.filter(data => data != workerData);
  					workerData.terminate();
  				}, terminateWorkerTimeout);
  			}
  		} else {
  			pool = pool.filter(data => data != workerData);
  		}
  	}
  }

  function clearTerminateTimeout(workerData) {
  	const { terminateTimeout } = workerData;
  	if (terminateTimeout) {
  		clearTimeout(terminateTimeout);
  		workerData.terminateTimeout = null;
  	}
  }

  function e(e){const t=()=>URL.createObjectURL(new Blob(['const{Array:e,Object:t,Number:n,Math:r,Error:s,Uint8Array:i,Uint16Array:o,Uint32Array:c,Int32Array:f,Map:a,DataView:l,Promise:u,TextEncoder:w,crypto:h,postMessage:d,TransformStream:p,ReadableStream:y,WritableStream:m,CompressionStream:b,DecompressionStream:g}=self;class k{constructor(e){return class extends p{constructor(t,n){const r=new e(n);super({transform(e,t){t.enqueue(r.append(e))},flush(e){const t=r.flush();t&&e.enqueue(t)}})}}}}const v=[];for(let e=0;256>e;e++){let t=e;for(let e=0;8>e;e++)1&t?t=t>>>1^3988292384:t>>>=1;v[e]=t}class S{constructor(e){this.t=e||-1}append(e){let t=0|this.t;for(let n=0,r=0|e.length;r>n;n++)t=t>>>8^v[255&(t^e[n])];this.t=t}get(){return~this.t}}class z extends p{constructor(){const e=new S;super({transform(t){e.append(t)},flush(t){const n=new i(4);new l(n.buffer).setUint32(0,e.get()),t.enqueue(n)}})}}const C={concat(e,t){if(0===e.length||0===t.length)return e.concat(t);const n=e[e.length-1],r=C.i(n);return 32===r?e.concat(t):C.o(t,r,0|n,e.slice(0,e.length-1))},l(e){const t=e.length;if(0===t)return 0;const n=e[t-1];return 32*(t-1)+C.i(n)},u(e,t){if(32*e.length<t)return e;const n=(e=e.slice(0,r.ceil(t/32))).length;return t&=31,n>0&&t&&(e[n-1]=C.h(t,e[n-1]&2147483648>>t-1,1)),e},h:(e,t,n)=>32===e?t:(n?0|t:t<<32-e)+1099511627776*e,i:e=>r.round(e/1099511627776)||32,o(e,t,n,r){for(void 0===r&&(r=[]);t>=32;t-=32)r.push(n),n=0;if(0===t)return r.concat(e);for(let s=0;s<e.length;s++)r.push(n|e[s]>>>t),n=e[s]<<32-t;const s=e.length?e[e.length-1]:0,i=C.i(s);return r.push(C.h(t+i&31,t+i>32?n:r.pop(),1)),r}},I={p:{m(e){const t=C.l(e)/8,n=new i(t);let r;for(let s=0;t>s;s++)0==(3&s)&&(r=e[s/4]),n[s]=r>>>24,r<<=8;return n},g(e){const t=[];let n,r=0;for(n=0;n<e.length;n++)r=r<<8|e[n],3==(3&n)&&(t.push(r),r=0);return 3&n&&t.push(C.h(8*(3&n),r)),t}}},x={getRandomValues(e){const t=new c(e.buffer),n=e=>{let t=987654321;const n=4294967295;return()=>(t=36969*(65535&t)+(t>>16)&n,(((t<<16)+(e=18e3*(65535&e)+(e>>16)&n)&n)/4294967296+.5)*(r.random()>.5?1:-1))};for(let s,i=0;i<e.length;i+=4){const e=n(4294967296*(s||r.random()));s=987654071*e(),t[i/4]=4294967296*e()|0}return e}},_={importKey:e=>new _.k(I.p.g(e)),v(e,t,n,r){if(n=n||1e4,0>r||0>n)throw new s("invalid params to pbkdf2");const i=1+(r>>5)<<2;let o,c,f,a,u;const w=new ArrayBuffer(i),h=new l(w);let d=0;const p=C;for(t=I.p.g(t),u=1;(i||1)>d;u++){for(o=c=e.encrypt(p.concat(t,[u])),f=1;n>f;f++)for(c=e.encrypt(c),a=0;a<c.length;a++)o[a]^=c[a];for(f=0;(i||1)>d&&f<o.length;f++)h.setInt32(d,o[f]),d+=4}return w.slice(0,r/8)},k:class{constructor(t){const n=this,i=n.S=class{constructor(e){const t=this;t.blockSize=512,t.C=[1732584193,4023233417,2562383102,271733878,3285377520],t.I=[1518500249,1859775393,2400959708,3395469782],e?(t._=e._.slice(0),t.A=e.A.slice(0),t.D=e.D):t.reset()}reset(){const e=this;return e._=e.C.slice(0),e.A=[],e.D=0,e}update(e){const t=this;"string"==typeof e&&(e=I.V.g(e));const n=t.A=C.concat(t.A,e),r=t.D,i=t.D=r+C.l(e);if(i>9007199254740991)throw new s("Cannot hash more than 2^53 - 1 bits");const o=new c(n);let f=0;for(let e=t.blockSize+r-(t.blockSize+r&t.blockSize-1);i>=e;e+=t.blockSize)t.R(o.subarray(16*f,16*(f+1))),f+=1;return n.splice(0,16*f),t}B(){const e=this;let t=e.A;const n=e._;t=C.concat(t,[C.h(1,1)]);for(let e=t.length+2;15&e;e++)t.push(0);for(t.push(r.floor(e.D/4294967296)),t.push(0|e.D);t.length;)e.R(t.splice(0,16));return e.reset(),n}M(e,t,n,r){return e>19?e>39?e>59?e>79?void 0:t^n^r:t&n|t&r|n&r:t^n^r:t&n|~t&r}K(e,t){return t<<e|t>>>32-e}R(t){const n=this,s=n._,i=e(80);for(let e=0;16>e;e++)i[e]=t[e];let o=s[0],c=s[1],f=s[2],a=s[3],l=s[4];for(let e=0;79>=e;e++){16>e||(i[e]=n.K(1,i[e-3]^i[e-8]^i[e-14]^i[e-16]));const t=n.K(5,o)+n.M(e,c,f,a)+l+i[e]+n.I[r.floor(e/20)]|0;l=a,a=f,f=n.K(30,c),c=o,o=t}s[0]=s[0]+o|0,s[1]=s[1]+c|0,s[2]=s[2]+f|0,s[3]=s[3]+a|0,s[4]=s[4]+l|0}},o=[[],[]];n.P=[new i,new i];const f=n.P[0].blockSize/32;t.length>f&&(t=i.hash(t));for(let e=0;f>e;e++)o[0][e]=909522486^t[e],o[1][e]=1549556828^t[e];n.P[0].update(o[0]),n.P[1].update(o[1]),n.U=new i(n.P[0])}reset(){const e=this;e.U=new e.S(e.P[0]),e.N=!1}update(e){this.N=!0,this.U.update(e)}digest(){const e=this,t=e.U.B(),n=new e.S(e.P[1]).update(t).B();return e.reset(),n}encrypt(e){if(this.N)throw new s("encrypt on already updated hmac called!");return this.update(e),this.digest(e)}}},A=void 0!==h&&"function"==typeof h.getRandomValues;function D(e){return A?h.getRandomValues(e):x.getRandomValues(e)}const V={name:"PBKDF2"},R=t.assign({hash:{name:"HMAC"}},V),B=t.assign({iterations:1e3,hash:{name:"SHA-1"}},V),E=["deriveBits"],M=[8,12,16],K=[16,24,32],P=[0,0,0,0],U=void 0!==h,N=U&&h.subtle,T=U&&void 0!==N,W=I.p,H=class{constructor(e){const t=this;t.T=[[[],[],[],[],[]],[[],[],[],[],[]]],t.T[0][0][0]||t.W();const n=t.T[0][4],r=t.T[1],i=e.length;let o,c,f,a=1;if(4!==i&&6!==i&&8!==i)throw new s("invalid aes key size");for(t.I=[c=e.slice(0),f=[]],o=i;4*i+28>o;o++){let e=c[o-1];(o%i==0||8===i&&o%i==4)&&(e=n[e>>>24]<<24^n[e>>16&255]<<16^n[e>>8&255]<<8^n[255&e],o%i==0&&(e=e<<8^e>>>24^a<<24,a=a<<1^283*(a>>7))),c[o]=c[o-i]^e}for(let e=0;o;e++,o--){const t=c[3&e?o:o-4];f[e]=4>=o||4>e?t:r[0][n[t>>>24]]^r[1][n[t>>16&255]]^r[2][n[t>>8&255]]^r[3][n[255&t]]}}encrypt(e){return this.H(e,0)}decrypt(e){return this.H(e,1)}W(){const e=this.T[0],t=this.T[1],n=e[4],r=t[4],s=[],i=[];let o,c,f,a;for(let e=0;256>e;e++)i[(s[e]=e<<1^283*(e>>7))^e]=e;for(let l=o=0;!n[l];l^=c||1,o=i[o]||1){let i=o^o<<1^o<<2^o<<3^o<<4;i=i>>8^255&i^99,n[l]=i,r[i]=l,a=s[f=s[c=s[l]]];let u=16843009*a^65537*f^257*c^16843008*l,w=257*s[i]^16843008*i;for(let n=0;4>n;n++)e[n][l]=w=w<<24^w>>>8,t[n][i]=u=u<<24^u>>>8}for(let n=0;5>n;n++)e[n]=e[n].slice(0),t[n]=t[n].slice(0)}H(e,t){if(4!==e.length)throw new s("invalid aes block size");const n=this.I[t],r=n.length/4-2,i=[0,0,0,0],o=this.T[t],c=o[0],f=o[1],a=o[2],l=o[3],u=o[4];let w,h,d,p=e[0]^n[0],y=e[t?3:1]^n[1],m=e[2]^n[2],b=e[t?1:3]^n[3],g=4;for(let e=0;r>e;e++)w=c[p>>>24]^f[y>>16&255]^a[m>>8&255]^l[255&b]^n[g],h=c[y>>>24]^f[m>>16&255]^a[b>>8&255]^l[255&p]^n[g+1],d=c[m>>>24]^f[b>>16&255]^a[p>>8&255]^l[255&y]^n[g+2],b=c[b>>>24]^f[p>>16&255]^a[y>>8&255]^l[255&m]^n[g+3],g+=4,p=w,y=h,m=d;for(let e=0;4>e;e++)i[t?3&-e:e]=u[p>>>24]<<24^u[y>>16&255]<<16^u[m>>8&255]<<8^u[255&b]^n[g++],w=p,p=y,y=m,m=b,b=w;return i}},L=class{constructor(e,t){this.L=e,this.j=t,this.F=t}reset(){this.F=this.j}update(e){return this.O(this.L,e,this.F)}q(e){if(255==(e>>24&255)){let t=e>>16&255,n=e>>8&255,r=255&e;255===t?(t=0,255===n?(n=0,255===r?r=0:++r):++n):++t,e=0,e+=t<<16,e+=n<<8,e+=r}else e+=1<<24;return e}G(e){0===(e[0]=this.q(e[0]))&&(e[1]=this.q(e[1]))}O(e,t,n){let r;if(!(r=t.length))return[];const s=C.l(t);for(let s=0;r>s;s+=4){this.G(n);const r=e.encrypt(n);t[s]^=r[0],t[s+1]^=r[1],t[s+2]^=r[2],t[s+3]^=r[3]}return C.u(t,s)}},j=_.k;let F=U&&T&&"function"==typeof N.importKey,O=U&&T&&"function"==typeof N.deriveBits;class q extends p{constructor({password:e,signed:n,encryptionStrength:r}){super({start(){t.assign(this,{ready:new u((e=>this.J=e)),password:e,signed:n,X:r-1,pending:new i})},async transform(e,t){const n=this,{password:r,X:o,J:c,ready:f}=n;r?(await(async(e,t,n,r)=>{const i=await Q(e,t,n,Y(r,0,M[t])),o=Y(r,M[t]);if(i[0]!=o[0]||i[1]!=o[1])throw new s("Invalid password")})(n,o,r,Y(e,0,M[o]+2)),e=Y(e,M[o]+2),c()):await f;const a=new i(e.length-10-(e.length-10)%16);t.enqueue(J(n,e,a,0,10,!0))},async flush(e){const{signed:t,Y:n,Z:r,pending:o,ready:c}=this;await c;const f=Y(o,0,o.length-10),a=Y(o,o.length-10);let l=new i;if(f.length){const e=$(W,f);r.update(e);const t=n.update(e);l=Z(W,t)}if(t){const e=Y(Z(W,r.digest()),0,10);for(let t=0;10>t;t++)if(e[t]!=a[t])throw new s("Invalid signature")}e.enqueue(l)}})}}class G extends p{constructor({password:e,encryptionStrength:n}){let r;super({start(){t.assign(this,{ready:new u((e=>this.J=e)),password:e,X:n-1,pending:new i})},async transform(e,t){const n=this,{password:r,X:s,J:o,ready:c}=n;let f=new i;r?(f=await(async(e,t,n)=>{const r=D(new i(M[t]));return X(r,await Q(e,t,n,r))})(n,s,r),o()):await c;const a=new i(f.length+e.length-e.length%16);a.set(f,0),t.enqueue(J(n,e,a,f.length,0))},async flush(e){const{Y:t,Z:n,pending:s,ready:o}=this;await o;let c=new i;if(s.length){const e=t.update($(W,s));n.update(e),c=Z(W,e)}r.signature=Z(W,n.digest()).slice(0,10),e.enqueue(X(c,r.signature))}}),r=this}}function J(e,t,n,r,s,o){const{Y:c,Z:f,pending:a}=e,l=t.length-s;let u;for(a.length&&(t=X(a,t),n=((e,t)=>{if(t&&t>e.length){const n=e;(e=new i(t)).set(n,0)}return e})(n,l-l%16)),u=0;l-16>=u;u+=16){const e=$(W,Y(t,u,u+16));o&&f.update(e);const s=c.update(e);o||f.update(s),n.set(Z(W,s),u+r)}return e.pending=Y(t,u),n}async function Q(n,r,s,o){n.password=null;const c=(e=>{if(void 0===w){const t=new i((e=unescape(encodeURIComponent(e))).length);for(let n=0;n<t.length;n++)t[n]=e.charCodeAt(n);return t}return(new w).encode(e)})(s),f=await(async(e,t,n,r,s)=>{if(!F)return _.importKey(t);try{return await N.importKey("raw",t,n,!1,s)}catch(e){return F=!1,_.importKey(t)}})(0,c,R,0,E),a=await(async(e,t,n)=>{if(!O)return _.v(t,e.salt,B.iterations,n);try{return await N.deriveBits(e,t,n)}catch(r){return O=!1,_.v(t,e.salt,B.iterations,n)}})(t.assign({salt:o},B),f,8*(2*K[r]+2)),l=new i(a),u=$(W,Y(l,0,K[r])),h=$(W,Y(l,K[r],2*K[r])),d=Y(l,2*K[r]);return t.assign(n,{keys:{key:u,$:h,passwordVerification:d},Y:new L(new H(u),e.from(P)),Z:new j(h)}),d}function X(e,t){let n=e;return e.length+t.length&&(n=new i(e.length+t.length),n.set(e,0),n.set(t,e.length)),n}function Y(e,t,n){return e.subarray(t,n)}function Z(e,t){return e.m(t)}function $(e,t){return e.g(t)}class ee extends p{constructor({password:e,passwordVerification:n}){super({start(){t.assign(this,{password:e,passwordVerification:n}),se(this,e)},transform(e,t){const n=this;if(n.password){const t=ne(n,e.subarray(0,12));if(n.password=null,t[11]!=n.passwordVerification)throw new s("Invalid password");e=e.subarray(12)}t.enqueue(ne(n,e))}})}}class te extends p{constructor({password:e,passwordVerification:n}){super({start(){t.assign(this,{password:e,passwordVerification:n}),se(this,e)},transform(e,t){const n=this;let r,s;if(n.password){n.password=null;const t=D(new i(12));t[11]=n.passwordVerification,r=new i(e.length+t.length),r.set(re(n,t),0),s=12}else r=new i(e.length),s=0;r.set(re(n,e),s),t.enqueue(r)}})}}function ne(e,t){const n=new i(t.length);for(let r=0;r<t.length;r++)n[r]=oe(e)^t[r],ie(e,n[r]);return n}function re(e,t){const n=new i(t.length);for(let r=0;r<t.length;r++)n[r]=oe(e)^t[r],ie(e,t[r]);return n}function se(e,n){const r=[305419896,591751049,878082192];t.assign(e,{keys:r,ee:new S(r[0]),te:new S(r[2])});for(let t=0;t<n.length;t++)ie(e,n.charCodeAt(t))}function ie(e,t){let[n,s,i]=e.keys;e.ee.append([t]),n=~e.ee.get(),s=fe(r.imul(fe(s+ce(n)),134775813)+1),e.te.append([s>>>24]),i=~e.te.get(),e.keys=[n,s,i]}function oe(e){const t=2|e.keys[2];return ce(r.imul(t,1^t)>>>8)}function ce(e){return 255&e}function fe(e){return 4294967295&e}class ae extends p{constructor(e,{chunkSize:t,CompressionStream:n,CompressionStreamNative:r}){super({});const{compressed:s,encrypted:i,useCompressionStream:o,zipCrypto:c,signed:f,level:a}=e,u=this;let w,h,d=ue(super.readable);i&&!c||!f||([d,w]=d.tee(),w=de(w,new z)),s&&(d=he(d,o,{level:a,chunkSize:t},r,n)),i&&(c?d=de(d,new te(e)):(h=new G(e),d=de(d,h))),we(u,d,(async()=>{let e;i&&!c&&(e=h.signature),i&&!c||!f||(e=await w.getReader().read(),e=new l(e.value.buffer).getUint32(0)),u.signature=e}))}}class le extends p{constructor(e,{chunkSize:t,DecompressionStream:n,DecompressionStreamNative:r}){super({});const{zipCrypto:i,encrypted:o,signed:c,signature:f,compressed:a,useCompressionStream:u}=e;let w,h,d=ue(super.readable);o&&(i?d=de(d,new ee(e)):(h=new q(e),d=de(d,h))),a&&(d=he(d,u,{chunkSize:t},r,n)),o&&!i||!c||([d,w]=d.tee(),w=de(w,new z)),we(this,d,(async()=>{if((!o||i)&&c){const e=await w.getReader().read(),t=new l(e.value.buffer);if(f!=t.getUint32(0,!1))throw new s("Invalid signature")}}))}}function ue(e){return de(e,new p({transform(e,t){e&&e.length&&t.enqueue(e)}}))}function we(e,n,r){n=de(n,new p({flush:r})),t.defineProperty(e,"readable",{get:()=>n})}function he(e,t,n,r,s){try{e=de(e,new(t&&r?r:s)("deflate-raw",n))}catch(r){if(!t)throw r;e=de(e,new s("deflate-raw",n))}return e}function de(e,t){return e.pipeThrough(t)}class pe extends p{constructor(e,n){super({});const r=this,{codecType:s}=e;let i;s.startsWith("deflate")?i=ae:s.startsWith("inflate")&&(i=le);let o=0;const c=new i(e,n),f=super.readable,a=new p({transform(e,t){e&&e.length&&(o+=e.length,t.enqueue(e))},flush(){const{signature:e}=c;t.assign(r,{signature:e,size:o})}});t.defineProperty(r,"readable",{get:()=>f.pipeThrough(c).pipeThrough(a)})}}const ye=new a,me=new a;let be=0;async function ge(e){try{const{options:t,scripts:r,config:s}=e;r&&r.length&&importScripts.apply(void 0,r),self.initCodec&&self.initCodec(),s.CompressionStreamNative=self.CompressionStream,s.DecompressionStreamNative=self.DecompressionStream,self.Deflate&&(s.CompressionStream=new k(self.Deflate)),self.Inflate&&(s.DecompressionStream=new k(self.Inflate));const i={highWaterMark:1,size:()=>s.chunkSize},o=e.readable||new y({async pull(e){const t=new u((e=>ye.set(be,e)));ke({type:"pull",messageId:be}),be=(be+1)%n.MAX_SAFE_INTEGER;const{value:r,done:s}=await t;e.enqueue(r),s&&e.close()}},i),c=e.writable||new m({async write(e){let t;const r=new u((e=>t=e));me.set(be,t),ke({type:"data",value:e,messageId:be}),be=(be+1)%n.MAX_SAFE_INTEGER,await r}},i),f=new pe(t,s);await o.pipeThrough(f).pipeTo(c,{preventAbort:!0});try{await c.close()}catch(e){}const{signature:a,size:l}=f;ke({type:"close",result:{signature:a,size:l}})}catch(e){ve(e)}}function ke(e){let{value:t}=e;if(t)if(t.length)try{t=new i(t),e.value=t.buffer,d(e,[e.value])}catch(t){d(e)}else d(e);else d(e)}function ve(e){const{message:t,stack:n,code:r,name:s}=e;d({error:{message:t,stack:n,code:r,name:s}})}function Se(t){return ze(t.map((([t,n])=>new e(t).fill(n,0,t))))}function ze(t){return t.reduce(((t,n)=>t.concat(e.isArray(n)?ze(n):n)),[])}addEventListener("message",(({data:e})=>{const{type:t,messageId:n,value:r,done:s}=e;try{if("start"==t&&ge(e),"data"==t){const e=ye.get(n);ye.delete(n),e({value:new i(r),done:s})}if("ack"==t){const e=me.get(n);me.delete(n),e()}}catch(e){ve(e)}}));const Ce=[0,1,2,3].concat(...Se([[2,4],[2,5],[4,6],[4,7],[8,8],[8,9],[16,10],[16,11],[32,12],[32,13],[64,14],[64,15],[2,0],[1,16],[1,17],[2,18],[2,19],[4,20],[4,21],[8,22],[8,23],[16,24],[16,25],[32,26],[32,27],[64,28],[64,29]]));function Ie(){const e=this;function t(e,t){let n=0;do{n|=1&e,e>>>=1,n<<=1}while(--t>0);return n>>>1}e.ne=n=>{const s=e.re,i=e.ie.se,o=e.ie.oe;let c,f,a,l=-1;for(n.ce=0,n.fe=573,c=0;o>c;c++)0!==s[2*c]?(n.ae[++n.ce]=l=c,n.le[c]=0):s[2*c+1]=0;for(;2>n.ce;)a=n.ae[++n.ce]=2>l?++l:0,s[2*a]=1,n.le[a]=0,n.ue--,i&&(n.we-=i[2*a+1]);for(e.he=l,c=r.floor(n.ce/2);c>=1;c--)n.de(s,c);a=o;do{c=n.ae[1],n.ae[1]=n.ae[n.ce--],n.de(s,1),f=n.ae[1],n.ae[--n.fe]=c,n.ae[--n.fe]=f,s[2*a]=s[2*c]+s[2*f],n.le[a]=r.max(n.le[c],n.le[f])+1,s[2*c+1]=s[2*f+1]=a,n.ae[1]=a++,n.de(s,1)}while(n.ce>=2);n.ae[--n.fe]=n.ae[1],(t=>{const n=e.re,r=e.ie.se,s=e.ie.pe,i=e.ie.ye,o=e.ie.me;let c,f,a,l,u,w,h=0;for(l=0;15>=l;l++)t.be[l]=0;for(n[2*t.ae[t.fe]+1]=0,c=t.fe+1;573>c;c++)f=t.ae[c],l=n[2*n[2*f+1]+1]+1,l>o&&(l=o,h++),n[2*f+1]=l,f>e.he||(t.be[l]++,u=0,i>f||(u=s[f-i]),w=n[2*f],t.ue+=w*(l+u),r&&(t.we+=w*(r[2*f+1]+u)));if(0!==h){do{for(l=o-1;0===t.be[l];)l--;t.be[l]--,t.be[l+1]+=2,t.be[o]--,h-=2}while(h>0);for(l=o;0!==l;l--)for(f=t.be[l];0!==f;)a=t.ae[--c],a>e.he||(n[2*a+1]!=l&&(t.ue+=(l-n[2*a+1])*n[2*a],n[2*a+1]=l),f--)}})(n),((e,n,r)=>{const s=[];let i,o,c,f=0;for(i=1;15>=i;i++)s[i]=f=f+r[i-1]<<1;for(o=0;n>=o;o++)c=e[2*o+1],0!==c&&(e[2*o]=t(s[c]++,c))})(s,e.he,n.be)}}function xe(e,t,n,r,s){const i=this;i.se=e,i.pe=t,i.ye=n,i.oe=r,i.me=s}Ie.ge=[0,1,2,3,4,5,6,7].concat(...Se([[2,8],[2,9],[2,10],[2,11],[4,12],[4,13],[4,14],[4,15],[8,16],[8,17],[8,18],[8,19],[16,20],[16,21],[16,22],[16,23],[32,24],[32,25],[32,26],[31,27],[1,28]])),Ie.ke=[0,1,2,3,4,5,6,7,8,10,12,14,16,20,24,28,32,40,48,56,64,80,96,112,128,160,192,224,0],Ie.ve=[0,1,2,3,4,6,8,12,16,24,32,48,64,96,128,192,256,384,512,768,1024,1536,2048,3072,4096,6144,8192,12288,16384,24576],Ie.Se=e=>256>e?Ce[e]:Ce[256+(e>>>7)],Ie.ze=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],Ie.Ce=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],Ie.Ie=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],Ie.xe=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];const _e=Se([[144,8],[112,9],[24,7],[8,8]]);xe._e=ze([12,140,76,204,44,172,108,236,28,156,92,220,60,188,124,252,2,130,66,194,34,162,98,226,18,146,82,210,50,178,114,242,10,138,74,202,42,170,106,234,26,154,90,218,58,186,122,250,6,134,70,198,38,166,102,230,22,150,86,214,54,182,118,246,14,142,78,206,46,174,110,238,30,158,94,222,62,190,126,254,1,129,65,193,33,161,97,225,17,145,81,209,49,177,113,241,9,137,73,201,41,169,105,233,25,153,89,217,57,185,121,249,5,133,69,197,37,165,101,229,21,149,85,213,53,181,117,245,13,141,77,205,45,173,109,237,29,157,93,221,61,189,125,253,19,275,147,403,83,339,211,467,51,307,179,435,115,371,243,499,11,267,139,395,75,331,203,459,43,299,171,427,107,363,235,491,27,283,155,411,91,347,219,475,59,315,187,443,123,379,251,507,7,263,135,391,71,327,199,455,39,295,167,423,103,359,231,487,23,279,151,407,87,343,215,471,55,311,183,439,119,375,247,503,15,271,143,399,79,335,207,463,47,303,175,431,111,367,239,495,31,287,159,415,95,351,223,479,63,319,191,447,127,383,255,511,0,64,32,96,16,80,48,112,8,72,40,104,24,88,56,120,4,68,36,100,20,84,52,116,3,131,67,195,35,163,99,227].map(((e,t)=>[e,_e[t]])));const Ae=Se([[30,5]]);function De(e,t,n,r,s){const i=this;i.Ae=e,i.De=t,i.Ve=n,i.Re=r,i.Be=s}xe.Ee=ze([0,16,8,24,4,20,12,28,2,18,10,26,6,22,14,30,1,17,9,25,5,21,13,29,3,19,11,27,7,23].map(((e,t)=>[e,Ae[t]]))),xe.Me=new xe(xe._e,Ie.ze,257,286,15),xe.Ke=new xe(xe.Ee,Ie.Ce,0,30,15),xe.Pe=new xe(null,Ie.Ie,0,19,7);const Ve=[new De(0,0,0,0,0),new De(4,4,8,4,1),new De(4,5,16,8,1),new De(4,6,32,32,1),new De(4,4,16,16,2),new De(8,16,32,32,2),new De(8,16,128,128,2),new De(8,32,128,256,2),new De(32,128,258,1024,2),new De(32,258,258,4096,2)],Re=["need dictionary","stream end","","","stream error","data error","","buffer error","",""];function Be(e,t,n,r){const s=e[2*t],i=e[2*n];return i>s||s==i&&r[t]<=r[n]}function Ee(){const e=this;let t,n,s,c,f,a,l,u,w,h,d,p,y,m,b,g,k,v,S,z,C,I,x,_,A,D,V,R,B,E,M,K,P;const U=new Ie,N=new Ie,T=new Ie;let W,H,L,j,F,O;function q(){let t;for(t=0;286>t;t++)M[2*t]=0;for(t=0;30>t;t++)K[2*t]=0;for(t=0;19>t;t++)P[2*t]=0;M[512]=1,e.ue=e.we=0,H=L=0}function G(e,t){let n,r=-1,s=e[1],i=0,o=7,c=4;0===s&&(o=138,c=3),e[2*(t+1)+1]=65535;for(let f=0;t>=f;f++)n=s,s=e[2*(f+1)+1],++i<o&&n==s||(c>i?P[2*n]+=i:0!==n?(n!=r&&P[2*n]++,P[32]++):i>10?P[36]++:P[34]++,i=0,r=n,0===s?(o=138,c=3):n==s?(o=6,c=3):(o=7,c=4))}function J(t){e.Ue[e.pending++]=t}function Q(e){J(255&e),J(e>>>8&255)}function X(e,t){let n;const r=t;O>16-r?(n=e,F|=n<<O&65535,Q(F),F=n>>>16-O,O+=r-16):(F|=e<<O&65535,O+=r)}function Y(e,t){const n=2*e;X(65535&t[n],65535&t[n+1])}function Z(e,t){let n,r,s=-1,i=e[1],o=0,c=7,f=4;for(0===i&&(c=138,f=3),n=0;t>=n;n++)if(r=i,i=e[2*(n+1)+1],++o>=c||r!=i){if(f>o)do{Y(r,P)}while(0!=--o);else 0!==r?(r!=s&&(Y(r,P),o--),Y(16,P),X(o-3,2)):o>10?(Y(18,P),X(o-11,7)):(Y(17,P),X(o-3,3));o=0,s=r,0===i?(c=138,f=3):r==i?(c=6,f=3):(c=7,f=4)}}function $(){16==O?(Q(F),F=0,O=0):8>O||(J(255&F),F>>>=8,O-=8)}function ee(t,n){let s,i,o;if(e.Ne[H]=t,e.Te[H]=255&n,H++,0===t?M[2*n]++:(L++,t--,M[2*(Ie.ge[n]+256+1)]++,K[2*Ie.Se(t)]++),0==(8191&H)&&V>2){for(s=8*H,i=C-k,o=0;30>o;o++)s+=K[2*o]*(5+Ie.Ce[o]);if(s>>>=3,L<r.floor(H/2)&&s<r.floor(i/2))return!0}return H==W-1}function te(t,n){let r,s,i,o,c=0;if(0!==H)do{r=e.Ne[c],s=e.Te[c],c++,0===r?Y(s,t):(i=Ie.ge[s],Y(i+256+1,t),o=Ie.ze[i],0!==o&&(s-=Ie.ke[i],X(s,o)),r--,i=Ie.Se(r),Y(i,n),o=Ie.Ce[i],0!==o&&(r-=Ie.ve[i],X(r,o)))}while(H>c);Y(256,t),j=t[513]}function ne(){O>8?Q(F):O>0&&J(255&F),F=0,O=0}function re(t,n,r){X(0+(r?1:0),3),((t,n)=>{ne(),j=8,Q(n),Q(~n),e.Ue.set(u.subarray(t,t+n),e.pending),e.pending+=n})(t,n)}function se(n){((t,n,r)=>{let s,i,o=0;V>0?(U.ne(e),N.ne(e),o=(()=>{let t;for(G(M,U.he),G(K,N.he),T.ne(e),t=18;t>=3&&0===P[2*Ie.xe[t]+1];t--);return e.ue+=14+3*(t+1),t})(),s=e.ue+3+7>>>3,i=e.we+3+7>>>3,i>s||(s=i)):s=i=n+5,n+4>s||-1==t?i==s?(X(2+(r?1:0),3),te(xe._e,xe.Ee)):(X(4+(r?1:0),3),((e,t,n)=>{let r;for(X(e-257,5),X(t-1,5),X(n-4,4),r=0;n>r;r++)X(P[2*Ie.xe[r]+1],3);Z(M,e-1),Z(K,t-1)})(U.he+1,N.he+1,o+1),te(M,K)):re(t,n,r),q(),r&&ne()})(0>k?-1:k,C-k,n),k=C,t.We()}function ie(){let e,n,r,s;do{if(s=w-x-C,0===s&&0===C&&0===x)s=f;else if(-1==s)s--;else if(C>=f+f-262){u.set(u.subarray(f,f+f),0),I-=f,C-=f,k-=f,e=y,r=e;do{n=65535&d[--r],d[r]=f>n?0:n-f}while(0!=--e);e=f,r=e;do{n=65535&h[--r],h[r]=f>n?0:n-f}while(0!=--e);s+=f}if(0===t.He)return;e=t.Le(u,C+x,s),x+=e,3>x||(p=255&u[C],p=(p<<g^255&u[C+1])&b)}while(262>x&&0!==t.He)}function oe(e){let t,n,r=A,s=C,i=_;const o=C>f-262?C-(f-262):0;let c=E;const a=l,w=C+258;let d=u[s+i-1],p=u[s+i];B>_||(r>>=2),c>x&&(c=x);do{if(t=e,u[t+i]==p&&u[t+i-1]==d&&u[t]==u[s]&&u[++t]==u[s+1]){s+=2,t++;do{}while(u[++s]==u[++t]&&u[++s]==u[++t]&&u[++s]==u[++t]&&u[++s]==u[++t]&&u[++s]==u[++t]&&u[++s]==u[++t]&&u[++s]==u[++t]&&u[++s]==u[++t]&&w>s);if(n=258-(w-s),s=w-258,n>i){if(I=e,i=n,n>=c)break;d=u[s+i-1],p=u[s+i]}}}while((e=65535&h[e&a])>o&&0!=--r);return i>x?x:i}e.le=[],e.be=[],e.ae=[],M=[],K=[],P=[],e.de=(t,n)=>{const r=e.ae,s=r[n];let i=n<<1;for(;i<=e.ce&&(i<e.ce&&Be(t,r[i+1],r[i],e.le)&&i++,!Be(t,s,r[i],e.le));)r[n]=r[i],n=i,i<<=1;r[n]=s},e.je=(t,S,I,H,L,G)=>(H||(H=8),L||(L=8),G||(G=0),t.Fe=null,-1==S&&(S=6),1>L||L>9||8!=H||9>I||I>15||0>S||S>9||0>G||G>2?-2:(t.Oe=e,a=I,f=1<<a,l=f-1,m=L+7,y=1<<m,b=y-1,g=r.floor((m+3-1)/3),u=new i(2*f),h=[],d=[],W=1<<L+6,e.Ue=new i(4*W),s=4*W,e.Ne=new o(W),e.Te=new i(W),V=S,R=G,(t=>(t.qe=t.Ge=0,t.Fe=null,e.pending=0,e.Je=0,n=113,c=0,U.re=M,U.ie=xe.Me,N.re=K,N.ie=xe.Ke,T.re=P,T.ie=xe.Pe,F=0,O=0,j=8,q(),(()=>{w=2*f,d[y-1]=0;for(let e=0;y-1>e;e++)d[e]=0;D=Ve[V].De,B=Ve[V].Ae,E=Ve[V].Ve,A=Ve[V].Re,C=0,k=0,x=0,v=_=2,z=0,p=0})(),0))(t))),e.Qe=()=>42!=n&&113!=n&&666!=n?-2:(e.Te=null,e.Ne=null,e.Ue=null,d=null,h=null,u=null,e.Oe=null,113==n?-3:0),e.Xe=(e,t,n)=>{let r=0;return-1==t&&(t=6),0>t||t>9||0>n||n>2?-2:(Ve[V].Be!=Ve[t].Be&&0!==e.qe&&(r=e.Ye(1)),V!=t&&(V=t,D=Ve[V].De,B=Ve[V].Ae,E=Ve[V].Ve,A=Ve[V].Re),R=n,r)},e.Ze=(e,t,r)=>{let s,i=r,o=0;if(!t||42!=n)return-2;if(3>i)return 0;for(i>f-262&&(i=f-262,o=r-i),u.set(t.subarray(o,o+i),0),C=i,k=i,p=255&u[0],p=(p<<g^255&u[1])&b,s=0;i-3>=s;s++)p=(p<<g^255&u[s+2])&b,h[s&l]=d[p],d[p]=s;return 0},e.Ye=(r,i)=>{let o,w,m,A,B;if(i>4||0>i)return-2;if(!r.$e||!r.et&&0!==r.He||666==n&&4!=i)return r.Fe=Re[4],-2;if(0===r.tt)return r.Fe=Re[7],-5;var E;if(t=r,A=c,c=i,42==n&&(w=8+(a-8<<4)<<8,m=(V-1&255)>>1,m>3&&(m=3),w|=m<<6,0!==C&&(w|=32),w+=31-w%31,n=113,J((E=w)>>8&255),J(255&E)),0!==e.pending){if(t.We(),0===t.tt)return c=-1,0}else if(0===t.He&&A>=i&&4!=i)return t.Fe=Re[7],-5;if(666==n&&0!==t.He)return r.Fe=Re[7],-5;if(0!==t.He||0!==x||0!=i&&666!=n){switch(B=-1,Ve[V].Be){case 0:B=(e=>{let n,r=65535;for(r>s-5&&(r=s-5);;){if(1>=x){if(ie(),0===x&&0==e)return 0;if(0===x)break}if(C+=x,x=0,n=k+r,(0===C||C>=n)&&(x=C-n,C=n,se(!1),0===t.tt))return 0;if(C-k>=f-262&&(se(!1),0===t.tt))return 0}return se(4==e),0===t.tt?4==e?2:0:4==e?3:1})(i);break;case 1:B=(e=>{let n,r=0;for(;;){if(262>x){if(ie(),262>x&&0==e)return 0;if(0===x)break}if(3>x||(p=(p<<g^255&u[C+2])&b,r=65535&d[p],h[C&l]=d[p],d[p]=C),0===r||(C-r&65535)>f-262||2!=R&&(v=oe(r)),3>v)n=ee(0,255&u[C]),x--,C++;else if(n=ee(C-I,v-3),x-=v,v>D||3>x)C+=v,v=0,p=255&u[C],p=(p<<g^255&u[C+1])&b;else{v--;do{C++,p=(p<<g^255&u[C+2])&b,r=65535&d[p],h[C&l]=d[p],d[p]=C}while(0!=--v);C++}if(n&&(se(!1),0===t.tt))return 0}return se(4==e),0===t.tt?4==e?2:0:4==e?3:1})(i);break;case 2:B=(e=>{let n,r,s=0;for(;;){if(262>x){if(ie(),262>x&&0==e)return 0;if(0===x)break}if(3>x||(p=(p<<g^255&u[C+2])&b,s=65535&d[p],h[C&l]=d[p],d[p]=C),_=v,S=I,v=2,0!==s&&D>_&&f-262>=(C-s&65535)&&(2!=R&&(v=oe(s)),5>=v&&(1==R||3==v&&C-I>4096)&&(v=2)),3>_||v>_)if(0!==z){if(n=ee(0,255&u[C-1]),n&&se(!1),C++,x--,0===t.tt)return 0}else z=1,C++,x--;else{r=C+x-3,n=ee(C-1-S,_-3),x-=_-1,_-=2;do{++C>r||(p=(p<<g^255&u[C+2])&b,s=65535&d[p],h[C&l]=d[p],d[p]=C)}while(0!=--_);if(z=0,v=2,C++,n&&(se(!1),0===t.tt))return 0}}return 0!==z&&(n=ee(0,255&u[C-1]),z=0),se(4==e),0===t.tt?4==e?2:0:4==e?3:1})(i)}if(2!=B&&3!=B||(n=666),0==B||2==B)return 0===t.tt&&(c=-1),0;if(1==B){if(1==i)X(2,3),Y(256,xe._e),$(),9>1+j+10-O&&(X(2,3),Y(256,xe._e),$()),j=7;else if(re(0,0,!1),3==i)for(o=0;y>o;o++)d[o]=0;if(t.We(),0===t.tt)return c=-1,0}}return 4!=i?0:1}}function Me(){const e=this;e.nt=0,e.rt=0,e.He=0,e.qe=0,e.tt=0,e.Ge=0}function Ke(e){const t=new Me,n=(o=e&&e.chunkSize?e.chunkSize:65536)+5*(r.floor(o/16383)+1);var o;const c=new i(n);let f=e?e.level:-1;void 0===f&&(f=-1),t.je(f),t.$e=c,this.append=(e,r)=>{let o,f,a=0,l=0,u=0;const w=[];if(e.length){t.nt=0,t.et=e,t.He=e.length;do{if(t.rt=0,t.tt=n,o=t.Ye(0),0!=o)throw new s("deflating: "+t.Fe);t.rt&&(t.rt==n?w.push(new i(c)):w.push(c.slice(0,t.rt))),u+=t.rt,r&&t.nt>0&&t.nt!=a&&(r(t.nt),a=t.nt)}while(t.He>0||0===t.tt);return w.length>1?(f=new i(u),w.forEach((e=>{f.set(e,l),l+=e.length}))):f=w[0]||new i,f}},this.flush=()=>{let e,r,o=0,f=0;const a=[];do{if(t.rt=0,t.tt=n,e=t.Ye(4),1!=e&&0!=e)throw new s("deflating: "+t.Fe);n-t.tt>0&&a.push(c.slice(0,t.rt)),f+=t.rt}while(t.He>0||0===t.tt);return t.Qe(),r=new i(f),a.forEach((e=>{r.set(e,o),o+=e.length})),r}}Me.prototype={je(e,t){const n=this;return n.Oe=new Ee,t||(t=15),n.Oe.je(n,e,t)},Ye(e){const t=this;return t.Oe?t.Oe.Ye(t,e):-2},Qe(){const e=this;if(!e.Oe)return-2;const t=e.Oe.Qe();return e.Oe=null,t},Xe(e,t){const n=this;return n.Oe?n.Oe.Xe(n,e,t):-2},Ze(e,t){const n=this;return n.Oe?n.Oe.Ze(n,e,t):-2},Le(e,t,n){const r=this;let s=r.He;return s>n&&(s=n),0===s?0:(r.He-=s,e.set(r.et.subarray(r.nt,r.nt+s),t),r.nt+=s,r.qe+=s,s)},We(){const e=this;let t=e.Oe.pending;t>e.tt&&(t=e.tt),0!==t&&(e.$e.set(e.Oe.Ue.subarray(e.Oe.Je,e.Oe.Je+t),e.rt),e.rt+=t,e.Oe.Je+=t,e.Ge+=t,e.tt-=t,e.Oe.pending-=t,0===e.Oe.pending&&(e.Oe.Je=0))}};const Pe=[0,1,3,7,15,31,63,127,255,511,1023,2047,4095,8191,16383,32767,65535],Ue=[96,7,256,0,8,80,0,8,16,84,8,115,82,7,31,0,8,112,0,8,48,0,9,192,80,7,10,0,8,96,0,8,32,0,9,160,0,8,0,0,8,128,0,8,64,0,9,224,80,7,6,0,8,88,0,8,24,0,9,144,83,7,59,0,8,120,0,8,56,0,9,208,81,7,17,0,8,104,0,8,40,0,9,176,0,8,8,0,8,136,0,8,72,0,9,240,80,7,4,0,8,84,0,8,20,85,8,227,83,7,43,0,8,116,0,8,52,0,9,200,81,7,13,0,8,100,0,8,36,0,9,168,0,8,4,0,8,132,0,8,68,0,9,232,80,7,8,0,8,92,0,8,28,0,9,152,84,7,83,0,8,124,0,8,60,0,9,216,82,7,23,0,8,108,0,8,44,0,9,184,0,8,12,0,8,140,0,8,76,0,9,248,80,7,3,0,8,82,0,8,18,85,8,163,83,7,35,0,8,114,0,8,50,0,9,196,81,7,11,0,8,98,0,8,34,0,9,164,0,8,2,0,8,130,0,8,66,0,9,228,80,7,7,0,8,90,0,8,26,0,9,148,84,7,67,0,8,122,0,8,58,0,9,212,82,7,19,0,8,106,0,8,42,0,9,180,0,8,10,0,8,138,0,8,74,0,9,244,80,7,5,0,8,86,0,8,22,192,8,0,83,7,51,0,8,118,0,8,54,0,9,204,81,7,15,0,8,102,0,8,38,0,9,172,0,8,6,0,8,134,0,8,70,0,9,236,80,7,9,0,8,94,0,8,30,0,9,156,84,7,99,0,8,126,0,8,62,0,9,220,82,7,27,0,8,110,0,8,46,0,9,188,0,8,14,0,8,142,0,8,78,0,9,252,96,7,256,0,8,81,0,8,17,85,8,131,82,7,31,0,8,113,0,8,49,0,9,194,80,7,10,0,8,97,0,8,33,0,9,162,0,8,1,0,8,129,0,8,65,0,9,226,80,7,6,0,8,89,0,8,25,0,9,146,83,7,59,0,8,121,0,8,57,0,9,210,81,7,17,0,8,105,0,8,41,0,9,178,0,8,9,0,8,137,0,8,73,0,9,242,80,7,4,0,8,85,0,8,21,80,8,258,83,7,43,0,8,117,0,8,53,0,9,202,81,7,13,0,8,101,0,8,37,0,9,170,0,8,5,0,8,133,0,8,69,0,9,234,80,7,8,0,8,93,0,8,29,0,9,154,84,7,83,0,8,125,0,8,61,0,9,218,82,7,23,0,8,109,0,8,45,0,9,186,0,8,13,0,8,141,0,8,77,0,9,250,80,7,3,0,8,83,0,8,19,85,8,195,83,7,35,0,8,115,0,8,51,0,9,198,81,7,11,0,8,99,0,8,35,0,9,166,0,8,3,0,8,131,0,8,67,0,9,230,80,7,7,0,8,91,0,8,27,0,9,150,84,7,67,0,8,123,0,8,59,0,9,214,82,7,19,0,8,107,0,8,43,0,9,182,0,8,11,0,8,139,0,8,75,0,9,246,80,7,5,0,8,87,0,8,23,192,8,0,83,7,51,0,8,119,0,8,55,0,9,206,81,7,15,0,8,103,0,8,39,0,9,174,0,8,7,0,8,135,0,8,71,0,9,238,80,7,9,0,8,95,0,8,31,0,9,158,84,7,99,0,8,127,0,8,63,0,9,222,82,7,27,0,8,111,0,8,47,0,9,190,0,8,15,0,8,143,0,8,79,0,9,254,96,7,256,0,8,80,0,8,16,84,8,115,82,7,31,0,8,112,0,8,48,0,9,193,80,7,10,0,8,96,0,8,32,0,9,161,0,8,0,0,8,128,0,8,64,0,9,225,80,7,6,0,8,88,0,8,24,0,9,145,83,7,59,0,8,120,0,8,56,0,9,209,81,7,17,0,8,104,0,8,40,0,9,177,0,8,8,0,8,136,0,8,72,0,9,241,80,7,4,0,8,84,0,8,20,85,8,227,83,7,43,0,8,116,0,8,52,0,9,201,81,7,13,0,8,100,0,8,36,0,9,169,0,8,4,0,8,132,0,8,68,0,9,233,80,7,8,0,8,92,0,8,28,0,9,153,84,7,83,0,8,124,0,8,60,0,9,217,82,7,23,0,8,108,0,8,44,0,9,185,0,8,12,0,8,140,0,8,76,0,9,249,80,7,3,0,8,82,0,8,18,85,8,163,83,7,35,0,8,114,0,8,50,0,9,197,81,7,11,0,8,98,0,8,34,0,9,165,0,8,2,0,8,130,0,8,66,0,9,229,80,7,7,0,8,90,0,8,26,0,9,149,84,7,67,0,8,122,0,8,58,0,9,213,82,7,19,0,8,106,0,8,42,0,9,181,0,8,10,0,8,138,0,8,74,0,9,245,80,7,5,0,8,86,0,8,22,192,8,0,83,7,51,0,8,118,0,8,54,0,9,205,81,7,15,0,8,102,0,8,38,0,9,173,0,8,6,0,8,134,0,8,70,0,9,237,80,7,9,0,8,94,0,8,30,0,9,157,84,7,99,0,8,126,0,8,62,0,9,221,82,7,27,0,8,110,0,8,46,0,9,189,0,8,14,0,8,142,0,8,78,0,9,253,96,7,256,0,8,81,0,8,17,85,8,131,82,7,31,0,8,113,0,8,49,0,9,195,80,7,10,0,8,97,0,8,33,0,9,163,0,8,1,0,8,129,0,8,65,0,9,227,80,7,6,0,8,89,0,8,25,0,9,147,83,7,59,0,8,121,0,8,57,0,9,211,81,7,17,0,8,105,0,8,41,0,9,179,0,8,9,0,8,137,0,8,73,0,9,243,80,7,4,0,8,85,0,8,21,80,8,258,83,7,43,0,8,117,0,8,53,0,9,203,81,7,13,0,8,101,0,8,37,0,9,171,0,8,5,0,8,133,0,8,69,0,9,235,80,7,8,0,8,93,0,8,29,0,9,155,84,7,83,0,8,125,0,8,61,0,9,219,82,7,23,0,8,109,0,8,45,0,9,187,0,8,13,0,8,141,0,8,77,0,9,251,80,7,3,0,8,83,0,8,19,85,8,195,83,7,35,0,8,115,0,8,51,0,9,199,81,7,11,0,8,99,0,8,35,0,9,167,0,8,3,0,8,131,0,8,67,0,9,231,80,7,7,0,8,91,0,8,27,0,9,151,84,7,67,0,8,123,0,8,59,0,9,215,82,7,19,0,8,107,0,8,43,0,9,183,0,8,11,0,8,139,0,8,75,0,9,247,80,7,5,0,8,87,0,8,23,192,8,0,83,7,51,0,8,119,0,8,55,0,9,207,81,7,15,0,8,103,0,8,39,0,9,175,0,8,7,0,8,135,0,8,71,0,9,239,80,7,9,0,8,95,0,8,31,0,9,159,84,7,99,0,8,127,0,8,63,0,9,223,82,7,27,0,8,111,0,8,47,0,9,191,0,8,15,0,8,143,0,8,79,0,9,255],Ne=[80,5,1,87,5,257,83,5,17,91,5,4097,81,5,5,89,5,1025,85,5,65,93,5,16385,80,5,3,88,5,513,84,5,33,92,5,8193,82,5,9,90,5,2049,86,5,129,192,5,24577,80,5,2,87,5,385,83,5,25,91,5,6145,81,5,7,89,5,1537,85,5,97,93,5,24577,80,5,4,88,5,769,84,5,49,92,5,12289,82,5,13,90,5,3073,86,5,193,192,5,24577],Te=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],We=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,112,112],He=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],Le=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];function je(){let e,t,n,r,s,i;function o(e,t,o,c,f,a,l,u,w,h,d){let p,y,m,b,g,k,v,S,z,C,I,x,_,A,D;C=0,g=o;do{n[e[t+C]]++,C++,g--}while(0!==g);if(n[0]==o)return l[0]=-1,u[0]=0,0;for(S=u[0],k=1;15>=k&&0===n[k];k++);for(v=k,k>S&&(S=k),g=15;0!==g&&0===n[g];g--);for(m=g,S>g&&(S=g),u[0]=S,A=1<<k;g>k;k++,A<<=1)if(0>(A-=n[k]))return-3;if(0>(A-=n[g]))return-3;for(n[g]+=A,i[1]=k=0,C=1,_=2;0!=--g;)i[_]=k+=n[C],_++,C++;g=0,C=0;do{0!==(k=e[t+C])&&(d[i[k]++]=g),C++}while(++g<o);for(o=i[m],i[0]=g=0,C=0,b=-1,x=-S,s[0]=0,I=0,D=0;m>=v;v++)for(p=n[v];0!=p--;){for(;v>x+S;){if(b++,x+=S,D=m-x,D=D>S?S:D,(y=1<<(k=v-x))>p+1&&(y-=p+1,_=v,D>k))for(;++k<D&&(y<<=1)>n[++_];)y-=n[_];if(D=1<<k,h[0]+D>1440)return-3;s[b]=I=h[0],h[0]+=D,0!==b?(i[b]=g,r[0]=k,r[1]=S,k=g>>>x-S,r[2]=I-s[b-1]-k,w.set(r,3*(s[b-1]+k))):l[0]=I}for(r[1]=v-x,o>C?d[C]<c?(r[0]=256>d[C]?0:96,r[2]=d[C++]):(r[0]=a[d[C]-c]+16+64,r[2]=f[d[C++]-c]):r[0]=192,y=1<<v-x,k=g>>>x;D>k;k+=y)w.set(r,3*(I+k));for(k=1<<v-1;0!=(g&k);k>>>=1)g^=k;for(g^=k,z=(1<<x)-1;(g&z)!=i[b];)b--,x-=S,z=(1<<x)-1}return 0!==A&&1!=m?-5:0}function c(o){let c;for(e||(e=[],t=[],n=new f(16),r=[],s=new f(15),i=new f(16)),t.length<o&&(t=[]),c=0;o>c;c++)t[c]=0;for(c=0;16>c;c++)n[c]=0;for(c=0;3>c;c++)r[c]=0;s.set(n.subarray(0,15),0),i.set(n.subarray(0,16),0)}this.st=(n,r,s,i,f)=>{let a;return c(19),e[0]=0,a=o(n,0,19,19,null,null,s,r,i,e,t),-3==a?f.Fe="oversubscribed dynamic bit lengths tree":-5!=a&&0!==r[0]||(f.Fe="incomplete dynamic bit lengths tree",a=-3),a},this.it=(n,r,s,i,f,a,l,u,w)=>{let h;return c(288),e[0]=0,h=o(s,0,n,257,Te,We,a,i,u,e,t),0!=h||0===i[0]?(-3==h?w.Fe="oversubscribed literal/length tree":-4!=h&&(w.Fe="incomplete literal/length tree",h=-3),h):(c(288),h=o(s,n,r,0,He,Le,l,f,u,e,t),0!=h||0===f[0]&&n>257?(-3==h?w.Fe="oversubscribed distance tree":-5==h?(w.Fe="incomplete distance tree",h=-3):-4!=h&&(w.Fe="empty distance tree with lengths",h=-3),h):0)}}function Fe(){const e=this;let t,n,r,s,i=0,o=0,c=0,f=0,a=0,l=0,u=0,w=0,h=0,d=0;function p(e,t,n,r,s,i,o,c){let f,a,l,u,w,h,d,p,y,m,b,g,k,v,S,z;d=c.nt,p=c.He,w=o.ot,h=o.ct,y=o.write,m=y<o.read?o.read-y-1:o.end-y,b=Pe[e],g=Pe[t];do{for(;20>h;)p--,w|=(255&c.ft(d++))<<h,h+=8;if(f=w&b,a=n,l=r,z=3*(l+f),0!==(u=a[z]))for(;;){if(w>>=a[z+1],h-=a[z+1],0!=(16&u)){for(u&=15,k=a[z+2]+(w&Pe[u]),w>>=u,h-=u;15>h;)p--,w|=(255&c.ft(d++))<<h,h+=8;for(f=w&g,a=s,l=i,z=3*(l+f),u=a[z];;){if(w>>=a[z+1],h-=a[z+1],0!=(16&u)){for(u&=15;u>h;)p--,w|=(255&c.ft(d++))<<h,h+=8;if(v=a[z+2]+(w&Pe[u]),w>>=u,h-=u,m-=k,v>y){S=y-v;do{S+=o.end}while(0>S);if(u=o.end-S,k>u){if(k-=u,y-S>0&&u>y-S)do{o.lt[y++]=o.lt[S++]}while(0!=--u);else o.lt.set(o.lt.subarray(S,S+u),y),y+=u,S+=u,u=0;S=0}}else S=y-v,y-S>0&&2>y-S?(o.lt[y++]=o.lt[S++],o.lt[y++]=o.lt[S++],k-=2):(o.lt.set(o.lt.subarray(S,S+2),y),y+=2,S+=2,k-=2);if(y-S>0&&k>y-S)do{o.lt[y++]=o.lt[S++]}while(0!=--k);else o.lt.set(o.lt.subarray(S,S+k),y),y+=k,S+=k,k=0;break}if(0!=(64&u))return c.Fe="invalid distance code",k=c.He-p,k=k>h>>3?h>>3:k,p+=k,d-=k,h-=k<<3,o.ot=w,o.ct=h,c.He=p,c.qe+=d-c.nt,c.nt=d,o.write=y,-3;f+=a[z+2],f+=w&Pe[u],z=3*(l+f),u=a[z]}break}if(0!=(64&u))return 0!=(32&u)?(k=c.He-p,k=k>h>>3?h>>3:k,p+=k,d-=k,h-=k<<3,o.ot=w,o.ct=h,c.He=p,c.qe+=d-c.nt,c.nt=d,o.write=y,1):(c.Fe="invalid literal/length code",k=c.He-p,k=k>h>>3?h>>3:k,p+=k,d-=k,h-=k<<3,o.ot=w,o.ct=h,c.He=p,c.qe+=d-c.nt,c.nt=d,o.write=y,-3);if(f+=a[z+2],f+=w&Pe[u],z=3*(l+f),0===(u=a[z])){w>>=a[z+1],h-=a[z+1],o.lt[y++]=a[z+2],m--;break}}else w>>=a[z+1],h-=a[z+1],o.lt[y++]=a[z+2],m--}while(m>=258&&p>=10);return k=c.He-p,k=k>h>>3?h>>3:k,p+=k,d-=k,h-=k<<3,o.ot=w,o.ct=h,c.He=p,c.qe+=d-c.nt,c.nt=d,o.write=y,0}e.init=(e,i,o,c,f,a)=>{t=0,u=e,w=i,r=o,h=c,s=f,d=a,n=null},e.ut=(e,y,m)=>{let b,g,k,v,S,z,C,I=0,x=0,_=0;for(_=y.nt,v=y.He,I=e.ot,x=e.ct,S=e.write,z=S<e.read?e.read-S-1:e.end-S;;)switch(t){case 0:if(z>=258&&v>=10&&(e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,m=p(u,w,r,h,s,d,e,y),_=y.nt,v=y.He,I=e.ot,x=e.ct,S=e.write,z=S<e.read?e.read-S-1:e.end-S,0!=m)){t=1==m?7:9;break}c=u,n=r,o=h,t=1;case 1:for(b=c;b>x;){if(0===v)return e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);m=0,v--,I|=(255&y.ft(_++))<<x,x+=8}if(g=3*(o+(I&Pe[b])),I>>>=n[g+1],x-=n[g+1],k=n[g],0===k){f=n[g+2],t=6;break}if(0!=(16&k)){a=15&k,i=n[g+2],t=2;break}if(0==(64&k)){c=k,o=g/3+n[g+2];break}if(0!=(32&k)){t=7;break}return t=9,y.Fe="invalid literal/length code",m=-3,e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);case 2:for(b=a;b>x;){if(0===v)return e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);m=0,v--,I|=(255&y.ft(_++))<<x,x+=8}i+=I&Pe[b],I>>=b,x-=b,c=w,n=s,o=d,t=3;case 3:for(b=c;b>x;){if(0===v)return e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);m=0,v--,I|=(255&y.ft(_++))<<x,x+=8}if(g=3*(o+(I&Pe[b])),I>>=n[g+1],x-=n[g+1],k=n[g],0!=(16&k)){a=15&k,l=n[g+2],t=4;break}if(0==(64&k)){c=k,o=g/3+n[g+2];break}return t=9,y.Fe="invalid distance code",m=-3,e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);case 4:for(b=a;b>x;){if(0===v)return e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);m=0,v--,I|=(255&y.ft(_++))<<x,x+=8}l+=I&Pe[b],I>>=b,x-=b,t=5;case 5:for(C=S-l;0>C;)C+=e.end;for(;0!==i;){if(0===z&&(S==e.end&&0!==e.read&&(S=0,z=S<e.read?e.read-S-1:e.end-S),0===z&&(e.write=S,m=e.wt(y,m),S=e.write,z=S<e.read?e.read-S-1:e.end-S,S==e.end&&0!==e.read&&(S=0,z=S<e.read?e.read-S-1:e.end-S),0===z)))return e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);e.lt[S++]=e.lt[C++],z--,C==e.end&&(C=0),i--}t=0;break;case 6:if(0===z&&(S==e.end&&0!==e.read&&(S=0,z=S<e.read?e.read-S-1:e.end-S),0===z&&(e.write=S,m=e.wt(y,m),S=e.write,z=S<e.read?e.read-S-1:e.end-S,S==e.end&&0!==e.read&&(S=0,z=S<e.read?e.read-S-1:e.end-S),0===z)))return e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);m=0,e.lt[S++]=f,z--,t=0;break;case 7:if(x>7&&(x-=8,v++,_--),e.write=S,m=e.wt(y,m),S=e.write,z=S<e.read?e.read-S-1:e.end-S,e.read!=e.write)return e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);t=8;case 8:return m=1,e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);case 9:return m=-3,e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m);default:return m=-2,e.ot=I,e.ct=x,y.He=v,y.qe+=_-y.nt,y.nt=_,e.write=S,e.wt(y,m)}},e.ht=()=>{}}je.dt=(e,t,n,r)=>(e[0]=9,t[0]=5,n[0]=Ue,r[0]=Ne,0);const Oe=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];function qe(e,t){const n=this;let r,s=0,o=0,c=0,a=0;const l=[0],u=[0],w=new Fe;let h=0,d=new f(4320);const p=new je;n.ct=0,n.ot=0,n.lt=new i(t),n.end=t,n.read=0,n.write=0,n.reset=(e,t)=>{t&&(t[0]=0),6==s&&w.ht(e),s=0,n.ct=0,n.ot=0,n.read=n.write=0},n.reset(e,null),n.wt=(e,t)=>{let r,s,i;return s=e.rt,i=n.read,r=(i>n.write?n.end:n.write)-i,r>e.tt&&(r=e.tt),0!==r&&-5==t&&(t=0),e.tt-=r,e.Ge+=r,e.$e.set(n.lt.subarray(i,i+r),s),s+=r,i+=r,i==n.end&&(i=0,n.write==n.end&&(n.write=0),r=n.write-i,r>e.tt&&(r=e.tt),0!==r&&-5==t&&(t=0),e.tt-=r,e.Ge+=r,e.$e.set(n.lt.subarray(i,i+r),s),s+=r,i+=r),e.rt=s,n.read=i,t},n.ut=(e,t)=>{let i,f,y,m,b,g,k,v;for(m=e.nt,b=e.He,f=n.ot,y=n.ct,g=n.write,k=g<n.read?n.read-g-1:n.end-g;;){let S,z,C,I,x,_,A,D;switch(s){case 0:for(;3>y;){if(0===b)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);t=0,b--,f|=(255&e.ft(m++))<<y,y+=8}switch(i=7&f,h=1&i,i>>>1){case 0:f>>>=3,y-=3,i=7&y,f>>>=i,y-=i,s=1;break;case 1:S=[],z=[],C=[[]],I=[[]],je.dt(S,z,C,I),w.init(S[0],z[0],C[0],0,I[0],0),f>>>=3,y-=3,s=6;break;case 2:f>>>=3,y-=3,s=3;break;case 3:return f>>>=3,y-=3,s=9,e.Fe="invalid block type",t=-3,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t)}break;case 1:for(;32>y;){if(0===b)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);t=0,b--,f|=(255&e.ft(m++))<<y,y+=8}if((~f>>>16&65535)!=(65535&f))return s=9,e.Fe="invalid stored block lengths",t=-3,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);o=65535&f,f=y=0,s=0!==o?2:0!==h?7:0;break;case 2:if(0===b)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);if(0===k&&(g==n.end&&0!==n.read&&(g=0,k=g<n.read?n.read-g-1:n.end-g),0===k&&(n.write=g,t=n.wt(e,t),g=n.write,k=g<n.read?n.read-g-1:n.end-g,g==n.end&&0!==n.read&&(g=0,k=g<n.read?n.read-g-1:n.end-g),0===k)))return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);if(t=0,i=o,i>b&&(i=b),i>k&&(i=k),n.lt.set(e.Le(m,i),g),m+=i,b-=i,g+=i,k-=i,0!=(o-=i))break;s=0!==h?7:0;break;case 3:for(;14>y;){if(0===b)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);t=0,b--,f|=(255&e.ft(m++))<<y,y+=8}if(c=i=16383&f,(31&i)>29||(i>>5&31)>29)return s=9,e.Fe="too many length or distance symbols",t=-3,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);if(i=258+(31&i)+(i>>5&31),!r||r.length<i)r=[];else for(v=0;i>v;v++)r[v]=0;f>>>=14,y-=14,a=0,s=4;case 4:for(;4+(c>>>10)>a;){for(;3>y;){if(0===b)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);t=0,b--,f|=(255&e.ft(m++))<<y,y+=8}r[Oe[a++]]=7&f,f>>>=3,y-=3}for(;19>a;)r[Oe[a++]]=0;if(l[0]=7,i=p.st(r,l,u,d,e),0!=i)return-3==(t=i)&&(r=null,s=9),n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);a=0,s=5;case 5:for(;i=c,258+(31&i)+(i>>5&31)>a;){let o,w;for(i=l[0];i>y;){if(0===b)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);t=0,b--,f|=(255&e.ft(m++))<<y,y+=8}if(i=d[3*(u[0]+(f&Pe[i]))+1],w=d[3*(u[0]+(f&Pe[i]))+2],16>w)f>>>=i,y-=i,r[a++]=w;else{for(v=18==w?7:w-14,o=18==w?11:3;i+v>y;){if(0===b)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);t=0,b--,f|=(255&e.ft(m++))<<y,y+=8}if(f>>>=i,y-=i,o+=f&Pe[v],f>>>=v,y-=v,v=a,i=c,v+o>258+(31&i)+(i>>5&31)||16==w&&1>v)return r=null,s=9,e.Fe="invalid bit length repeat",t=-3,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);w=16==w?r[v-1]:0;do{r[v++]=w}while(0!=--o);a=v}}if(u[0]=-1,x=[],_=[],A=[],D=[],x[0]=9,_[0]=6,i=c,i=p.it(257+(31&i),1+(i>>5&31),r,x,_,A,D,d,e),0!=i)return-3==i&&(r=null,s=9),t=i,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);w.init(x[0],_[0],d,A[0],d,D[0]),s=6;case 6:if(n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,1!=(t=w.ut(n,e,t)))return n.wt(e,t);if(t=0,w.ht(e),m=e.nt,b=e.He,f=n.ot,y=n.ct,g=n.write,k=g<n.read?n.read-g-1:n.end-g,0===h){s=0;break}s=7;case 7:if(n.write=g,t=n.wt(e,t),g=n.write,k=g<n.read?n.read-g-1:n.end-g,n.read!=n.write)return n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);s=8;case 8:return t=1,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);case 9:return t=-3,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t);default:return t=-2,n.ot=f,n.ct=y,e.He=b,e.qe+=m-e.nt,e.nt=m,n.write=g,n.wt(e,t)}}},n.ht=e=>{n.reset(e,null),n.lt=null,d=null},n.yt=(e,t,r)=>{n.lt.set(e.subarray(t,t+r),0),n.read=n.write=r},n.bt=()=>1==s?1:0}const Ge=[0,0,255,255];function Je(){const e=this;function t(e){return e&&e.gt?(e.qe=e.Ge=0,e.Fe=null,e.gt.mode=7,e.gt.kt.reset(e,null),0):-2}e.mode=0,e.method=0,e.vt=[0],e.St=0,e.marker=0,e.zt=0,e.Ct=t=>(e.kt&&e.kt.ht(t),e.kt=null,0),e.It=(n,r)=>(n.Fe=null,e.kt=null,8>r||r>15?(e.Ct(n),-2):(e.zt=r,n.gt.kt=new qe(n,1<<r),t(n),0)),e.xt=(e,t)=>{let n,r;if(!e||!e.gt||!e.et)return-2;const s=e.gt;for(t=4==t?-5:0,n=-5;;)switch(s.mode){case 0:if(0===e.He)return n;if(n=t,e.He--,e.qe++,8!=(15&(s.method=e.ft(e.nt++)))){s.mode=13,e.Fe="unknown compression method",s.marker=5;break}if(8+(s.method>>4)>s.zt){s.mode=13,e.Fe="invalid win size",s.marker=5;break}s.mode=1;case 1:if(0===e.He)return n;if(n=t,e.He--,e.qe++,r=255&e.ft(e.nt++),((s.method<<8)+r)%31!=0){s.mode=13,e.Fe="incorrect header check",s.marker=5;break}if(0==(32&r)){s.mode=7;break}s.mode=2;case 2:if(0===e.He)return n;n=t,e.He--,e.qe++,s.St=(255&e.ft(e.nt++))<<24&4278190080,s.mode=3;case 3:if(0===e.He)return n;n=t,e.He--,e.qe++,s.St+=(255&e.ft(e.nt++))<<16&16711680,s.mode=4;case 4:if(0===e.He)return n;n=t,e.He--,e.qe++,s.St+=(255&e.ft(e.nt++))<<8&65280,s.mode=5;case 5:return 0===e.He?n:(n=t,e.He--,e.qe++,s.St+=255&e.ft(e.nt++),s.mode=6,2);case 6:return s.mode=13,e.Fe="need dictionary",s.marker=0,-2;case 7:if(n=s.kt.ut(e,n),-3==n){s.mode=13,s.marker=0;break}if(0==n&&(n=t),1!=n)return n;n=t,s.kt.reset(e,s.vt),s.mode=12;case 12:return e.He=0,1;case 13:return-3;default:return-2}},e._t=(e,t,n)=>{let r=0,s=n;if(!e||!e.gt||6!=e.gt.mode)return-2;const i=e.gt;return s<1<<i.zt||(s=(1<<i.zt)-1,r=n-s),i.kt.yt(t,r,s),i.mode=7,0},e.At=e=>{let n,r,s,i,o;if(!e||!e.gt)return-2;const c=e.gt;if(13!=c.mode&&(c.mode=13,c.marker=0),0===(n=e.He))return-5;for(r=e.nt,s=c.marker;0!==n&&4>s;)e.ft(r)==Ge[s]?s++:s=0!==e.ft(r)?0:4-s,r++,n--;return e.qe+=r-e.nt,e.nt=r,e.He=n,c.marker=s,4!=s?-3:(i=e.qe,o=e.Ge,t(e),e.qe=i,e.Ge=o,c.mode=7,0)},e.Dt=e=>e&&e.gt&&e.gt.kt?e.gt.kt.bt():-2}function Qe(){}function Xe(e){const t=new Qe,n=e&&e.chunkSize?r.floor(2*e.chunkSize):131072,o=new i(n);let c=!1;t.It(),t.$e=o,this.append=(e,r)=>{const f=[];let a,l,u=0,w=0,h=0;if(0!==e.length){t.nt=0,t.et=e,t.He=e.length;do{if(t.rt=0,t.tt=n,0!==t.He||c||(t.nt=0,c=!0),a=t.xt(0),c&&-5===a){if(0!==t.He)throw new s("inflating: bad input")}else if(0!==a&&1!==a)throw new s("inflating: "+t.Fe);if((c||1===a)&&t.He===e.length)throw new s("inflating: bad input");t.rt&&(t.rt===n?f.push(new i(o)):f.push(o.slice(0,t.rt))),h+=t.rt,r&&t.nt>0&&t.nt!=u&&(r(t.nt),u=t.nt)}while(t.He>0||0===t.tt);return f.length>1?(l=new i(h),f.forEach((e=>{l.set(e,w),w+=e.length}))):l=f[0]||new i,l}},this.flush=()=>{t.Ct()}}Qe.prototype={It(e){const t=this;return t.gt=new Je,e||(e=15),t.gt.It(t,e)},xt(e){const t=this;return t.gt?t.gt.xt(t,e):-2},Ct(){const e=this;if(!e.gt)return-2;const t=e.gt.Ct(e);return e.gt=null,t},At(){const e=this;return e.gt?e.gt.At(e):-2},_t(e,t){const n=this;return n.gt?n.gt._t(n,e,t):-2},ft(e){return this.et[e]},Le(e,t){return this.et.subarray(e,e+t)}},self.initCodec=()=>{self.Deflate=Ke,self.Inflate=Xe};\n'],{type:"text/javascript"}));e({workerScripts:{inflate:[t],deflate:[t]}});}

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */
  const ERR_ITERATOR_COMPLETED_TOO_SOON = "Writer iterator completed too soon";
  const HTTP_HEADER_CONTENT_TYPE = "Content-Type";
  const DEFAULT_CHUNK_SIZE = 64 * 1024;

  const PROPERTY_NAME_WRITABLE = "writable";

  class Stream {

  	constructor() {
  		this.size = 0;
  	}

  	init() {
  		this.initialized = true;
  	}
  }

  class Reader extends Stream {

  	get readable() {
  		const reader = this;
  		const { chunkSize = DEFAULT_CHUNK_SIZE } = reader;
  		const readable = new ReadableStream({
  			start() {
  				this.chunkOffset = 0;
  			},
  			async pull(controller) {
  				const { offset = 0, size, diskNumberStart } = readable;
  				const { chunkOffset } = this;
  				controller.enqueue(await readUint8Array(reader, offset + chunkOffset, Math.min(chunkSize, size - chunkOffset), diskNumberStart));
  				if (chunkOffset + chunkSize > size) {
  					controller.close();
  				} else {
  					this.chunkOffset += chunkSize;
  				}
  			}
  		});
  		return readable;
  	}
  }

  class BlobReader extends Reader {

  	constructor(blob) {
  		super();
  		Object.assign(this, {
  			blob,
  			size: blob.size
  		});
  	}

  	async readUint8Array(offset, length) {
  		const reader = this;
  		const offsetEnd = offset + length;
  		const blob = offset || offsetEnd < reader.size ? reader.blob.slice(offset, offsetEnd) : reader.blob;
  		return new Uint8Array(await blob.arrayBuffer());
  	}
  }

  class BlobWriter extends Stream {

  	constructor(contentType) {
  		super();
  		const writer = this;
  		const transformStream = new TransformStream();
  		const headers = [];
  		if (contentType) {
  			headers.push([HTTP_HEADER_CONTENT_TYPE, contentType]);
  		}
  		Object.defineProperty(writer, PROPERTY_NAME_WRITABLE, {
  			get() {
  				return transformStream.writable;
  			}
  		});
  		writer.blob = new Response(transformStream.readable, { headers }).blob();
  	}

  	getData() {
  		return this.blob;
  	}
  }

  class SplitDataReader extends Reader {

  	constructor(readers) {
  		super();
  		this.readers = readers;
  	}

  	async init() {
  		super.init();
  		const reader = this;
  		const { readers } = reader;
  		reader.lastDiskNumber = 0;
  		await Promise.all(readers.map(async diskReader => {
  			await diskReader.init();
  			reader.size += diskReader.size;
  		}));
  	}

  	async readUint8Array(offset, length, diskNumber = 0) {
  		const reader = this;
  		const { readers } = this;
  		let result;
  		let currentDiskNumber = diskNumber;
  		if (currentDiskNumber == -1) {
  			currentDiskNumber = readers.length - 1;
  		}
  		let currentReaderOffset = offset;
  		while (currentReaderOffset >= readers[currentDiskNumber].size) {
  			currentReaderOffset -= readers[currentDiskNumber].size;
  			currentDiskNumber++;
  		}
  		const currentReader = readers[currentDiskNumber];
  		const currentReaderSize = currentReader.size;
  		if (currentReaderOffset + length <= currentReaderSize) {
  			result = await readUint8Array(currentReader, currentReaderOffset, length);
  		} else {
  			const chunkLength = currentReaderSize - currentReaderOffset;
  			result = new Uint8Array(length);
  			result.set(await readUint8Array(currentReader, currentReaderOffset, chunkLength));
  			result.set(await reader.readUint8Array(offset + chunkLength, length - chunkLength, diskNumber), chunkLength);
  		}
  		reader.lastDiskNumber = Math.max(currentDiskNumber, reader.lastDiskNumber);
  		return result;
  	}
  }

  class SplitDataWriter extends Stream {

  	constructor(writerGenerator, maxSize = 4294967295) {
  		super();
  		const zipWriter = this;
  		Object.assign(zipWriter, {
  			diskNumber: 0,
  			diskOffset: 0,
  			size: 0,
  			maxSize,
  			availableSize: maxSize
  		});
  		let diskSourceWriter, diskWritable, diskWriter;
  		const writable = new WritableStream({
  			async write(chunk) {
  				const { availableSize } = zipWriter;
  				if (!diskWriter) {
  					const { value, done } = await writerGenerator.next();
  					if (done && !value) {
  						throw new Error(ERR_ITERATOR_COMPLETED_TOO_SOON);
  					} else {
  						diskSourceWriter = value;
  						diskSourceWriter.size = 0;
  						if (diskSourceWriter.maxSize) {
  							zipWriter.maxSize = diskSourceWriter.maxSize;
  						}
  						zipWriter.availableSize = zipWriter.maxSize;
  						await initStream(diskSourceWriter);
  						diskWritable = value.writable;
  						diskWriter = diskWritable.getWriter();
  					}
  					await this.write(chunk);
  				} else if (chunk.length >= availableSize) {
  					await writeChunk(chunk.slice(0, availableSize));
  					await closeDisk();
  					zipWriter.diskOffset += diskSourceWriter.size;
  					zipWriter.diskNumber++;
  					diskWriter = null;
  					await this.write(chunk.slice(availableSize));
  				} else {
  					await writeChunk(chunk);
  				}
  			},
  			async close() {
  				await diskWriter.ready;
  				await closeDisk();
  			}
  		});
  		Object.defineProperty(zipWriter, PROPERTY_NAME_WRITABLE, {
  			get() {
  				return writable;
  			}
  		});

  		async function writeChunk(chunk) {
  			const chunkLength = chunk.length;
  			if (chunkLength) {
  				await diskWriter.ready;
  				await diskWriter.write(chunk);
  				diskSourceWriter.size += chunkLength;
  				zipWriter.size += chunkLength;
  				zipWriter.availableSize -= chunkLength;
  			}
  		}

  		async function closeDisk() {
  			diskWritable.size = diskSourceWriter.size;
  			await diskWriter.close();
  		}
  	}
  }

  async function initStream(stream, initSize) {
  	if (stream.init && !stream.initialized) {
  		await stream.init(initSize);
  	}
  }

  function initReader(reader) {
  	if (Array.isArray(reader)) {
  		reader = new SplitDataReader(reader);
  	}
  	if (reader instanceof ReadableStream) {
  		reader = {
  			readable: reader
  		};
  	}
  	return reader;
  }

  function initWriter(writer) {
  	if (writer.writable === UNDEFINED_VALUE && typeof writer.next == FUNCTION_TYPE$1) {
  		writer = new SplitDataWriter(writer);
  	}
  	if (writer instanceof WritableStream) {
  		writer = {
  			writable: writer
  		};
  	}
  	const { writable } = writer;
  	if (writable.size === UNDEFINED_VALUE) {
  		writable.size = 0;
  	}
  	const splitZipFile = writer instanceof SplitDataWriter;
  	if (!splitZipFile) {
  		Object.assign(writer, {
  			diskNumber: 0,
  			diskOffset: 0,
  			availableSize: Infinity,
  			maxSize: Infinity
  		});
  	}
  	return writer;
  }

  function readUint8Array(reader, offset, size, diskNumber) {
  	return reader.readUint8Array(offset, size, diskNumber);
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  /* global TextDecoder */

  const CP437 = "\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ".split("");
  CP437.length == 256;

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const PROPERTY_NAME_FILENAME = "filename";
  const PROPERTY_NAME_RAW_FILENAME = "rawFilename";
  const PROPERTY_NAME_COMMENT = "comment";
  const PROPERTY_NAME_RAW_COMMENT = "rawComment";
  const PROPERTY_NAME_UNCOMPPRESSED_SIZE = "uncompressedSize";
  const PROPERTY_NAME_COMPPRESSED_SIZE = "compressedSize";
  const PROPERTY_NAME_OFFSET = "offset";
  const PROPERTY_NAME_DISK_NUMBER_START = "diskNumberStart";
  const PROPERTY_NAME_LAST_MODIFICATION_DATE = "lastModDate";
  const PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE = "rawLastModDate";
  const PROPERTY_NAME_LAST_ACCESS_DATE = "lastAccessDate";
  const PROPERTY_NAME_CREATION_DATE = "creationDate";
  const PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTE = "internalFileAttribute";
  const PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTE = "externalFileAttribute";
  const PROPERTY_NAME_MS_DOS_COMPATIBLE = "msDosCompatible";
  const PROPERTY_NAME_ZIP64 = "zip64";

  const PROPERTY_NAMES = [
  	PROPERTY_NAME_FILENAME, PROPERTY_NAME_RAW_FILENAME, PROPERTY_NAME_COMPPRESSED_SIZE, PROPERTY_NAME_UNCOMPPRESSED_SIZE,
  	PROPERTY_NAME_LAST_MODIFICATION_DATE, PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE, PROPERTY_NAME_COMMENT, PROPERTY_NAME_RAW_COMMENT,
  	PROPERTY_NAME_LAST_ACCESS_DATE, PROPERTY_NAME_CREATION_DATE, PROPERTY_NAME_OFFSET, PROPERTY_NAME_DISK_NUMBER_START,
  	PROPERTY_NAME_DISK_NUMBER_START, PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTE, PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTE,
  	PROPERTY_NAME_MS_DOS_COMPATIBLE, PROPERTY_NAME_ZIP64,
  	"directory", "bitFlag", "encrypted", "signature", "filenameUTF8", "commentUTF8", "compressionMethod", "version", "versionMadeBy",
  	"extraField", "rawExtraField", "extraFieldZip64", "extraFieldUnicodePath", "extraFieldUnicodeComment", "extraFieldAES", "extraFieldNTFS",
  	"extraFieldExtendedTimestamp"];

  class Entry {

  	constructor(data) {
  		PROPERTY_NAMES.forEach(name => this[name] = data[name]);
  	}

  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  const ERR_DUPLICATED_NAME = "File already exists";
  const ERR_INVALID_COMMENT = "Zip file comment exceeds 64KB";
  const ERR_INVALID_ENTRY_COMMENT = "File entry comment exceeds 64KB";
  const ERR_INVALID_ENTRY_NAME = "File entry name exceeds 64KB";
  const ERR_INVALID_VERSION = "Version exceeds 65535";
  const ERR_INVALID_ENCRYPTION_STRENGTH = "The strength must equal 1, 2, or 3";
  const ERR_INVALID_EXTRAFIELD_TYPE = "Extra field type exceeds 65535";
  const ERR_INVALID_EXTRAFIELD_DATA = "Extra field data exceeds 64KB";
  const ERR_UNSUPPORTED_FORMAT = "Zip64 is not supported (make sure 'keepOrder' is set to 'true')";

  const EXTRAFIELD_DATA_AES = new Uint8Array([0x07, 0x00, 0x02, 0x00, 0x41, 0x45, 0x03, 0x00, 0x00]);

  let workers = 0;
  const pendingEntries = [];

  class ZipWriter {

  	constructor(writer, options = {}) {
  		writer = initWriter(writer);
  		Object.assign(this, {
  			writer,
  			addSplitZipSignature: writer instanceof SplitDataWriter,
  			options,
  			config: getConfiguration(),
  			files: new Map(),
  			filenames: new Set(),
  			offset: writer.writable.size,
  			pendingEntriesSize: 0,
  			pendingAddFileCalls: new Set(),
  			bufferedWrites: 0
  		});
  	}

  	async add(name = "", reader, options = {}) {
  		const zipWriter = this;
  		const {
  			pendingAddFileCalls,
  			config
  		} = zipWriter;
  		if (workers < config.maxWorkers) {
  			workers++;
  		} else {
  			await new Promise(resolve => pendingEntries.push(resolve));
  		}
  		let promiseAddFile;
  		try {
  			name = name.trim();
  			if (zipWriter.filenames.has(name)) {
  				throw new Error(ERR_DUPLICATED_NAME);
  			}
  			zipWriter.filenames.add(name);
  			promiseAddFile = addFile(zipWriter, name, reader, options);
  			pendingAddFileCalls.add(promiseAddFile);
  			return await promiseAddFile;
  		} catch (error) {
  			zipWriter.filenames.delete(name);
  			throw error;
  		} finally {
  			pendingAddFileCalls.delete(promiseAddFile);
  			const pendingEntry = pendingEntries.shift();
  			if (pendingEntry) {
  				pendingEntry();
  			} else {
  				workers--;
  			}
  		}
  	}

  	async close(comment = new Uint8Array(), options = {}) {
  		const zipWriter = this;
  		const { pendingAddFileCalls, writer } = this;
  		const { writable } = writer;
  		while (pendingAddFileCalls.size) {
  			await Promise.all(Array.from(pendingAddFileCalls));
  		}
  		await closeFile(this, comment, options);
  		const preventClose = getOptionValue(zipWriter, options, "preventClose");
  		if (!preventClose) {
  			await writable.close();
  		}
  		return writer.getData ? writer.getData() : writable;
  	}
  }

  async function addFile(zipWriter, name, reader, options) {
  	name = name.trim();
  	if (options.directory && (!name.endsWith(DIRECTORY_SIGNATURE))) {
  		name += DIRECTORY_SIGNATURE;
  	} else {
  		options.directory = name.endsWith(DIRECTORY_SIGNATURE);
  	}
  	const rawFilename = encodeText(name);
  	if (getLength(rawFilename) > MAX_16_BITS) {
  		throw new Error(ERR_INVALID_ENTRY_NAME);
  	}
  	const comment = options.comment || "";
  	const rawComment = encodeText(comment);
  	if (getLength(rawComment) > MAX_16_BITS) {
  		throw new Error(ERR_INVALID_ENTRY_COMMENT);
  	}
  	const version = getOptionValue(zipWriter, options, "version", VERSION_DEFLATE);
  	if (version > MAX_16_BITS) {
  		throw new Error(ERR_INVALID_VERSION);
  	}
  	const versionMadeBy = getOptionValue(zipWriter, options, "versionMadeBy", 20);
  	if (versionMadeBy > MAX_16_BITS) {
  		throw new Error(ERR_INVALID_VERSION);
  	}
  	const lastModDate = getOptionValue(zipWriter, options, PROPERTY_NAME_LAST_MODIFICATION_DATE, new Date());
  	const lastAccessDate = getOptionValue(zipWriter, options, PROPERTY_NAME_LAST_ACCESS_DATE);
  	const creationDate = getOptionValue(zipWriter, options, PROPERTY_NAME_CREATION_DATE);
  	const msDosCompatible = getOptionValue(zipWriter, options, PROPERTY_NAME_MS_DOS_COMPATIBLE, true);
  	const internalFileAttribute = getOptionValue(zipWriter, options, PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTE, 0);
  	const externalFileAttribute = getOptionValue(zipWriter, options, PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTE, 0);
  	const password = getOptionValue(zipWriter, options, "password");
  	const encryptionStrength = getOptionValue(zipWriter, options, "encryptionStrength", 3);
  	const zipCrypto = getOptionValue(zipWriter, options, "zipCrypto");
  	const extendedTimestamp = getOptionValue(zipWriter, options, "extendedTimestamp", true);
  	const keepOrder = getOptionValue(zipWriter, options, "keepOrder", true);
  	const level = getOptionValue(zipWriter, options, "level");
  	const useWebWorkers = getOptionValue(zipWriter, options, "useWebWorkers");
  	const bufferedWrite = getOptionValue(zipWriter, options, "bufferedWrite");
  	const dataDescriptorSignature = getOptionValue(zipWriter, options, "dataDescriptorSignature", false);
  	const signal = getOptionValue(zipWriter, options, "signal");
  	const useCompressionStream = getOptionValue(zipWriter, options, "useCompressionStream");
  	let dataDescriptor = getOptionValue(zipWriter, options, "dataDescriptor", true);
  	let zip64 = getOptionValue(zipWriter, options, PROPERTY_NAME_ZIP64);
  	if (password !== UNDEFINED_VALUE && encryptionStrength !== UNDEFINED_VALUE && (encryptionStrength < 1 || encryptionStrength > 3)) {
  		throw new Error(ERR_INVALID_ENCRYPTION_STRENGTH);
  	}
  	let rawExtraField = new Uint8Array();
  	const { extraField } = options;
  	if (extraField) {
  		let extraFieldSize = 0;
  		let offset = 0;
  		extraField.forEach(data => extraFieldSize += 4 + getLength(data));
  		rawExtraField = new Uint8Array(extraFieldSize);
  		extraField.forEach((data, type) => {
  			if (type > MAX_16_BITS) {
  				throw new Error(ERR_INVALID_EXTRAFIELD_TYPE);
  			}
  			if (getLength(data) > MAX_16_BITS) {
  				throw new Error(ERR_INVALID_EXTRAFIELD_DATA);
  			}
  			arraySet(rawExtraField, new Uint16Array([type]), offset);
  			arraySet(rawExtraField, new Uint16Array([getLength(data)]), offset + 2);
  			arraySet(rawExtraField, data, offset + 4);
  			offset += 4 + getLength(data);
  		});
  	}
  	let maximumCompressedSize = 0;
  	let maximumEntrySize = 0;
  	let uncompressedSize = 0;
  	const zip64Enabled = zip64 === true;
  	if (reader) {
  		reader = initReader(reader);
  		await initStream(reader);
  		if (reader.size === UNDEFINED_VALUE) {
  			dataDescriptor = true;
  			if (zip64 || zip64 === UNDEFINED_VALUE) {
  				zip64 = true;
  				maximumCompressedSize = MAX_32_BITS;
  			}
  		} else {
  			uncompressedSize = reader.size;
  			maximumCompressedSize = getMaximumCompressedSize(uncompressedSize);
  		}
  	}
  	const { diskOffset, diskNumber, maxSize } = zipWriter.writer;
  	const zip64UncompressedSize = zip64Enabled || uncompressedSize >= MAX_32_BITS;
  	const zip64CompressedSize = zip64Enabled || maximumCompressedSize >= MAX_32_BITS;
  	const zip64Offset = zip64Enabled || zipWriter.offset + zipWriter.pendingEntriesSize - diskOffset >= MAX_32_BITS;
  	const supportZip64SplitFile = getOptionValue(zipWriter, options, "supportZip64SplitFile", true);
  	const zip64DiskNumberStart = (supportZip64SplitFile && zip64Enabled) || diskNumber + Math.ceil(zipWriter.pendingEntriesSize / maxSize) >= MAX_16_BITS;
  	if (zip64Offset || zip64UncompressedSize || zip64CompressedSize || zip64DiskNumberStart) {
  		if (zip64 === false || !keepOrder) {
  			throw new Error(ERR_UNSUPPORTED_FORMAT);
  		} else {
  			zip64 = true;
  		}
  	}
  	zip64 = zip64 || false;
  	options = Object.assign({}, options, {
  		rawFilename,
  		rawComment,
  		version,
  		versionMadeBy,
  		lastModDate,
  		lastAccessDate,
  		creationDate,
  		rawExtraField,
  		zip64,
  		zip64UncompressedSize,
  		zip64CompressedSize,
  		zip64Offset,
  		zip64DiskNumberStart,
  		password,
  		level,
  		useWebWorkers,
  		encryptionStrength,
  		extendedTimestamp,
  		zipCrypto,
  		bufferedWrite,
  		keepOrder,
  		dataDescriptor,
  		dataDescriptorSignature,
  		signal,
  		msDosCompatible,
  		internalFileAttribute,
  		externalFileAttribute,
  		useCompressionStream
  	});
  	const headerInfo = getHeaderInfo(options);
  	const dataDescriptorInfo = getDataDescriptorInfo(options);
  	maximumEntrySize = getLength(headerInfo.localHeaderArray, dataDescriptorInfo.dataDescriptorArray) + maximumCompressedSize;
  	zipWriter.pendingEntriesSize += maximumEntrySize;
  	let fileEntry;
  	try {
  		fileEntry = await getFileEntry(zipWriter, name, reader, { headerInfo, dataDescriptorInfo }, options);
  	} finally {
  		zipWriter.pendingEntriesSize -= maximumEntrySize;
  	}
  	Object.assign(fileEntry, { name, comment, extraField });
  	return new Entry(fileEntry);
  }

  async function getFileEntry(zipWriter, name, reader, entryInfo, options) {
  	const {
  		files,
  		writer
  	} = zipWriter;
  	const {
  		keepOrder,
  		dataDescriptor,
  		signal
  	} = options;
  	const {
  		headerInfo
  	} = entryInfo;
  	const previousFileEntry = Array.from(files.values()).pop();
  	let fileEntry = {};
  	let bufferedWrite;
  	let releaseLockWriter;
  	let releaseLockCurrentFileEntry;
  	let writingBufferedEntryData;
  	let writingEntryData;
  	let fileWriter;
  	files.set(name, fileEntry);
  	try {
  		let lockPreviousFileEntry;
  		if (keepOrder) {
  			lockPreviousFileEntry = previousFileEntry && previousFileEntry.lock;
  			requestLockCurrentFileEntry();
  		}
  		if (options.bufferedWrite || zipWriter.writerLocked || (zipWriter.bufferedWrites && keepOrder) || !dataDescriptor) {
  			fileWriter = new BlobWriter();
  			fileWriter.writable.size = 0;
  			bufferedWrite = true;
  			zipWriter.bufferedWrites++;
  			await initStream(writer);
  		} else {
  			fileWriter = writer;
  			await requestLockWriter();
  		}
  		await initStream(fileWriter);
  		const { writable } = writer;
  		let { diskOffset } = writer;
  		if (zipWriter.addSplitZipSignature) {
  			delete zipWriter.addSplitZipSignature;
  			const signatureArray = new Uint8Array(4);
  			const signatureArrayView = getDataView(signatureArray);
  			setUint32(signatureArrayView, 0, SPLIT_ZIP_FILE_SIGNATURE);
  			await writeData(writable, signatureArray);
  			zipWriter.offset += 4;
  		}
  		if (!bufferedWrite) {
  			await lockPreviousFileEntry;
  			await skipDiskIfNeeded(writable);
  		}
  		const { diskNumber } = writer;
  		writingEntryData = true;
  		fileEntry.diskNumberStart = diskNumber;
  		fileEntry = await createFileEntry(reader, fileWriter, fileEntry, entryInfo, zipWriter.config, options);
  		writingEntryData = false;
  		files.set(name, fileEntry);
  		fileEntry.filename = name;
  		if (bufferedWrite) {
  			await fileWriter.writable.close();
  			let blob = await fileWriter.getData();
  			await lockPreviousFileEntry;
  			await requestLockWriter();
  			writingBufferedEntryData = true;
  			if (!dataDescriptor) {
  				blob = await writeExtraHeaderInfo(fileEntry, blob, writable, options);
  			}
  			await skipDiskIfNeeded(writable);
  			fileEntry.diskNumberStart = writer.diskNumber;
  			diskOffset = writer.diskOffset;
  			await blob.stream().pipeTo(writable, { preventClose: true, signal });
  			writable.size += blob.size;
  			writingBufferedEntryData = false;
  		}
  		fileEntry.offset = zipWriter.offset - diskOffset;
  		if (fileEntry.zip64) {
  			setZip64ExtraInfo(fileEntry, options);
  		} else if (fileEntry.offset >= MAX_32_BITS) {
  			throw new Error(ERR_UNSUPPORTED_FORMAT);
  		}
  		zipWriter.offset += fileEntry.length;
  		return fileEntry;
  	} catch (error) {
  		if ((bufferedWrite && writingBufferedEntryData) || (!bufferedWrite && writingEntryData)) {
  			zipWriter.hasCorruptedEntries = true;
  			if (error) {
  				error.corruptedEntry = true;
  			}
  			if (bufferedWrite) {
  				zipWriter.offset += fileWriter.writable.size;
  			} else {
  				zipWriter.offset = fileWriter.writable.size;
  			}
  		}
  		files.delete(name);
  		throw error;
  	} finally {
  		if (bufferedWrite) {
  			zipWriter.bufferedWrites--;
  		}
  		if (releaseLockCurrentFileEntry) {
  			releaseLockCurrentFileEntry();
  		}
  		if (releaseLockWriter) {
  			releaseLockWriter();
  		}
  	}

  	function requestLockCurrentFileEntry() {
  		fileEntry.lock = new Promise(resolve => releaseLockCurrentFileEntry = resolve);
  	}

  	async function requestLockWriter() {
  		zipWriter.writerLocked = true;
  		const { lockWriter } = zipWriter;
  		zipWriter.lockWriter = new Promise(resolve => releaseLockWriter = () => {
  			zipWriter.writerLocked = false;
  			resolve();
  		});
  		await lockWriter;
  	}

  	async function skipDiskIfNeeded(writable) {
  		if (headerInfo.localHeaderArray.length > writer.availableSize) {
  			writer.availableSize = 0;
  			await writeData(writable, new Uint8Array());
  		}
  	}
  }

  async function createFileEntry(reader, writer, { diskNumberStart, lock }, entryInfo, config, options) {
  	const {
  		headerInfo,
  		dataDescriptorInfo
  	} = entryInfo;
  	const {
  		localHeaderArray,
  		headerArray,
  		lastModDate,
  		rawLastModDate,
  		encrypted,
  		compressed,
  		version,
  		compressionMethod,
  		rawExtraFieldExtendedTimestamp,
  		rawExtraFieldNTFS,
  		rawExtraFieldAES
  	} = headerInfo;
  	const { dataDescriptorArray } = dataDescriptorInfo;
  	const {
  		rawFilename,
  		lastAccessDate,
  		creationDate,
  		password,
  		level,
  		zip64,
  		zip64UncompressedSize,
  		zip64CompressedSize,
  		zip64Offset,
  		zip64DiskNumberStart,
  		zipCrypto,
  		dataDescriptor,
  		directory,
  		versionMadeBy,
  		rawComment,
  		rawExtraField,
  		useWebWorkers,
  		onstart,
  		onprogress,
  		onend,
  		signal,
  		encryptionStrength,
  		extendedTimestamp,
  		msDosCompatible,
  		internalFileAttribute,
  		externalFileAttribute,
  		useCompressionStream
  	} = options;
  	const fileEntry = {
  		lock,
  		versionMadeBy,
  		zip64,
  		directory: Boolean(directory),
  		filenameUTF8: true,
  		rawFilename,
  		commentUTF8: true,
  		rawComment,
  		rawExtraFieldExtendedTimestamp,
  		rawExtraFieldNTFS,
  		rawExtraFieldAES,
  		rawExtraField,
  		extendedTimestamp,
  		msDosCompatible,
  		internalFileAttribute,
  		externalFileAttribute,
  		diskNumberStart
  	};
  	let compressedSize = 0;
  	let uncompressedSize = 0;
  	let signature;
  	const { writable } = writer;
  	if (reader) {
  		reader.chunkSize = getChunkSize(config);
  		await writeData(writable, localHeaderArray);
  		const readable = reader.readable;
  		const size = readable.size = reader.size;
  		const workerOptions = {
  			options: {
  				codecType: CODEC_DEFLATE,
  				level,
  				password,
  				encryptionStrength,
  				zipCrypto: encrypted && zipCrypto,
  				passwordVerification: encrypted && zipCrypto && (rawLastModDate >> 8) & 0xFF,
  				signed: true,
  				compressed,
  				encrypted,
  				useWebWorkers,
  				useCompressionStream,
  				transferStreams: false
  			},
  			config,
  			streamOptions: { signal, size, onstart, onprogress, onend }
  		};
  		const result = await runWorker({ readable, writable }, workerOptions);
  		writable.size += result.size;
  		signature = result.signature;
  		uncompressedSize = reader.size = readable.size;
  		compressedSize = result.size;
  	} else {
  		await writeData(writable, localHeaderArray);
  	}
  	let rawExtraFieldZip64;
  	if (zip64) {
  		let rawExtraFieldZip64Length = 4;
  		if (zip64UncompressedSize) {
  			rawExtraFieldZip64Length += 8;
  		}
  		if (zip64CompressedSize) {
  			rawExtraFieldZip64Length += 8;
  		}
  		if (zip64Offset) {
  			rawExtraFieldZip64Length += 8;
  		}
  		if (zip64DiskNumberStart) {
  			rawExtraFieldZip64Length += 4;
  		}
  		rawExtraFieldZip64 = new Uint8Array(rawExtraFieldZip64Length);
  	} else {
  		rawExtraFieldZip64 = new Uint8Array();
  	}
  	if (reader) {
  		setEntryInfo({
  			signature,
  			rawExtraFieldZip64,
  			compressedSize,
  			uncompressedSize,
  			headerInfo,
  			dataDescriptorInfo
  		}, options);
  	}
  	if (dataDescriptor) {
  		await writeData(writable, dataDescriptorArray);
  	}
  	Object.assign(fileEntry, {
  		uncompressedSize,
  		compressedSize,
  		lastModDate,
  		rawLastModDate,
  		creationDate,
  		lastAccessDate,
  		encrypted,
  		length: getLength(localHeaderArray, dataDescriptorArray) + compressedSize,
  		compressionMethod,
  		version,
  		headerArray,
  		signature,
  		rawExtraFieldZip64,
  		zip64UncompressedSize,
  		zip64CompressedSize,
  		zip64Offset,
  		zip64DiskNumberStart
  	});
  	return fileEntry;
  }

  function getHeaderInfo(options) {
  	const {
  		rawFilename,
  		lastModDate,
  		lastAccessDate,
  		creationDate,
  		password,
  		level,
  		zip64,
  		zipCrypto,
  		dataDescriptor,
  		directory,
  		rawExtraField,
  		encryptionStrength,
  		extendedTimestamp,
  	} = options;
  	const compressed = level !== 0 && !directory;
  	const encrypted = Boolean(password && getLength(password));
  	let version = options.version;
  	let rawExtraFieldAES;
  	if (encrypted && !zipCrypto) {
  		rawExtraFieldAES = new Uint8Array(getLength(EXTRAFIELD_DATA_AES) + 2);
  		const extraFieldAESView = getDataView(rawExtraFieldAES);
  		setUint16(extraFieldAESView, 0, EXTRAFIELD_TYPE_AES);
  		arraySet(rawExtraFieldAES, EXTRAFIELD_DATA_AES, 2);
  		setUint8(extraFieldAESView, 8, encryptionStrength);
  	} else {
  		rawExtraFieldAES = new Uint8Array();
  	}
  	let rawExtraFieldNTFS;
  	let rawExtraFieldExtendedTimestamp;
  	if (extendedTimestamp) {
  		rawExtraFieldExtendedTimestamp = new Uint8Array(9 + (lastAccessDate ? 4 : 0) + (creationDate ? 4 : 0));
  		const extraFieldExtendedTimestampView = getDataView(rawExtraFieldExtendedTimestamp);
  		setUint16(extraFieldExtendedTimestampView, 0, EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP);
  		setUint16(extraFieldExtendedTimestampView, 2, getLength(rawExtraFieldExtendedTimestamp) - 4);
  		const extraFieldExtendedTimestampFlag = 0x1 + (lastAccessDate ? 0x2 : 0) + (creationDate ? 0x4 : 0);
  		setUint8(extraFieldExtendedTimestampView, 4, extraFieldExtendedTimestampFlag);
  		setUint32(extraFieldExtendedTimestampView, 5, Math.floor(lastModDate.getTime() / 1000));
  		if (lastAccessDate) {
  			setUint32(extraFieldExtendedTimestampView, 9, Math.floor(lastAccessDate.getTime() / 1000));
  		}
  		if (creationDate) {
  			setUint32(extraFieldExtendedTimestampView, 13, Math.floor(creationDate.getTime() / 1000));
  		}
  		try {
  			rawExtraFieldNTFS = new Uint8Array(36);
  			const extraFieldNTFSView = getDataView(rawExtraFieldNTFS);
  			const lastModTimeNTFS = getTimeNTFS(lastModDate);
  			setUint16(extraFieldNTFSView, 0, EXTRAFIELD_TYPE_NTFS);
  			setUint16(extraFieldNTFSView, 2, 32);
  			setUint16(extraFieldNTFSView, 8, EXTRAFIELD_TYPE_NTFS_TAG1);
  			setUint16(extraFieldNTFSView, 10, 24);
  			setBigUint64(extraFieldNTFSView, 12, lastModTimeNTFS);
  			setBigUint64(extraFieldNTFSView, 20, getTimeNTFS(lastAccessDate) || lastModTimeNTFS);
  			setBigUint64(extraFieldNTFSView, 28, getTimeNTFS(creationDate) || lastModTimeNTFS);
  		} catch (_error) {
  			rawExtraFieldNTFS = new Uint8Array();
  		}
  	} else {
  		rawExtraFieldNTFS = rawExtraFieldExtendedTimestamp = new Uint8Array();
  	}
  	let bitFlag = BITFLAG_LANG_ENCODING_FLAG;
  	if (dataDescriptor) {
  		bitFlag = bitFlag | BITFLAG_DATA_DESCRIPTOR;
  	}
  	let compressionMethod = COMPRESSION_METHOD_STORE;
  	if (compressed) {
  		compressionMethod = COMPRESSION_METHOD_DEFLATE;
  	}
  	if (zip64) {
  		version = version > VERSION_ZIP64 ? version : VERSION_ZIP64;
  	}
  	if (encrypted) {
  		bitFlag = bitFlag | BITFLAG_ENCRYPTED;
  		if (!zipCrypto) {
  			version = version > VERSION_AES ? version : VERSION_AES;
  			compressionMethod = COMPRESSION_METHOD_AES;
  			if (compressed) {
  				rawExtraFieldAES[9] = COMPRESSION_METHOD_DEFLATE;
  			}
  		}
  	}
  	const headerArray = new Uint8Array(26);
  	const headerView = getDataView(headerArray);
  	setUint16(headerView, 0, version);
  	setUint16(headerView, 2, bitFlag);
  	setUint16(headerView, 4, compressionMethod);
  	const dateArray = new Uint32Array(1);
  	const dateView = getDataView(dateArray);
  	let lastModDateMsDos;
  	if (lastModDate < MIN_DATE) {
  		lastModDateMsDos = MIN_DATE;
  	} else if (lastModDate > MAX_DATE) {
  		lastModDateMsDos = MAX_DATE;
  	} else {
  		lastModDateMsDos = lastModDate;
  	}
  	setUint16(dateView, 0, (((lastModDateMsDos.getHours() << 6) | lastModDateMsDos.getMinutes()) << 5) | lastModDateMsDos.getSeconds() / 2);
  	setUint16(dateView, 2, ((((lastModDateMsDos.getFullYear() - 1980) << 4) | (lastModDateMsDos.getMonth() + 1)) << 5) | lastModDateMsDos.getDate());
  	const rawLastModDate = dateArray[0];
  	setUint32(headerView, 6, rawLastModDate);
  	setUint16(headerView, 22, getLength(rawFilename));
  	const extraFieldLength = getLength(rawExtraFieldAES, rawExtraFieldExtendedTimestamp, rawExtraFieldNTFS, rawExtraField);
  	setUint16(headerView, 24, extraFieldLength);
  	const localHeaderArray = new Uint8Array(30 + getLength(rawFilename) + extraFieldLength);
  	const localHeaderView = getDataView(localHeaderArray);
  	setUint32(localHeaderView, 0, LOCAL_FILE_HEADER_SIGNATURE);
  	arraySet(localHeaderArray, headerArray, 4);
  	arraySet(localHeaderArray, rawFilename, 30);
  	arraySet(localHeaderArray, rawExtraFieldAES, 30 + getLength(rawFilename));
  	arraySet(localHeaderArray, rawExtraFieldExtendedTimestamp, 30 + getLength(rawFilename, rawExtraFieldAES));
  	arraySet(localHeaderArray, rawExtraFieldNTFS, 30 + getLength(rawFilename, rawExtraFieldAES, rawExtraFieldExtendedTimestamp));
  	arraySet(localHeaderArray, rawExtraField, 30 + getLength(rawFilename, rawExtraFieldAES, rawExtraFieldExtendedTimestamp, rawExtraFieldNTFS));
  	return {
  		localHeaderArray,
  		headerArray,
  		headerView,
  		lastModDate,
  		rawLastModDate,
  		encrypted,
  		compressed,
  		version,
  		compressionMethod,
  		rawExtraFieldExtendedTimestamp,
  		rawExtraFieldNTFS,
  		rawExtraFieldAES
  	};
  }

  function getDataDescriptorInfo(options) {
  	const {
  		zip64,
  		dataDescriptor,
  		dataDescriptorSignature
  	} = options;
  	let dataDescriptorArray = new Uint8Array();
  	let dataDescriptorView, dataDescriptorOffset = 0;
  	if (dataDescriptor) {
  		dataDescriptorArray = new Uint8Array(zip64 ? (dataDescriptorSignature ? 24 : 20) : (dataDescriptorSignature ? 16 : 12));
  		dataDescriptorView = getDataView(dataDescriptorArray);
  		if (dataDescriptorSignature) {
  			dataDescriptorOffset = 4;
  			setUint32(dataDescriptorView, 0, DATA_DESCRIPTOR_RECORD_SIGNATURE);
  		}
  	}
  	return {
  		dataDescriptorArray,
  		dataDescriptorView,
  		dataDescriptorOffset
  	};
  }

  function setEntryInfo(entryInfo, options) {
  	const {
  		signature,
  		rawExtraFieldZip64,
  		compressedSize,
  		uncompressedSize,
  		headerInfo,
  		dataDescriptorInfo
  	} = entryInfo;
  	const {
  		headerView,
  		encrypted
  	} = headerInfo;
  	const {
  		dataDescriptorView,
  		dataDescriptorOffset
  	} = dataDescriptorInfo;
  	const {
  		zip64,
  		zip64UncompressedSize,
  		zip64CompressedSize,
  		zipCrypto,
  		dataDescriptor
  	} = options;
  	if ((!encrypted || zipCrypto) && signature !== UNDEFINED_VALUE) {
  		setUint32(headerView, 10, signature);
  		if (dataDescriptor) {
  			setUint32(dataDescriptorView, dataDescriptorOffset, signature);
  		}
  	}
  	if (zip64) {
  		const rawExtraFieldZip64View = getDataView(rawExtraFieldZip64);
  		setUint16(rawExtraFieldZip64View, 0, EXTRAFIELD_TYPE_ZIP64);
  		setUint16(rawExtraFieldZip64View, 2, rawExtraFieldZip64.length - 4);
  		let rawExtraFieldZip64Offset = 4;
  		if (zip64UncompressedSize) {
  			setUint32(headerView, 18, MAX_32_BITS);
  			setBigUint64(rawExtraFieldZip64View, rawExtraFieldZip64Offset, BigInt(uncompressedSize));
  			rawExtraFieldZip64Offset += 8;
  		}
  		if (zip64CompressedSize) {
  			setUint32(headerView, 14, MAX_32_BITS);
  			setBigUint64(rawExtraFieldZip64View, rawExtraFieldZip64Offset, BigInt(compressedSize));
  		}
  		if (dataDescriptor) {
  			setBigUint64(dataDescriptorView, dataDescriptorOffset + 4, BigInt(compressedSize));
  			setBigUint64(dataDescriptorView, dataDescriptorOffset + 12, BigInt(uncompressedSize));
  		}
  	} else {
  		setUint32(headerView, 14, compressedSize);
  		setUint32(headerView, 18, uncompressedSize);
  		if (dataDescriptor) {
  			setUint32(dataDescriptorView, dataDescriptorOffset + 4, compressedSize);
  			setUint32(dataDescriptorView, dataDescriptorOffset + 8, uncompressedSize);
  		}
  	}
  }

  async function writeExtraHeaderInfo(fileEntry, entryData, writable, { zipCrypto }) {
  	const arrayBuffer = await sliceAsArrayBuffer(entryData, 0, 26);
  	const arrayBufferView = new DataView(arrayBuffer);
  	if (!fileEntry.encrypted || zipCrypto) {
  		setUint32(arrayBufferView, 14, fileEntry.signature);
  	}
  	if (fileEntry.zip64) {
  		setUint32(arrayBufferView, 18, MAX_32_BITS);
  		setUint32(arrayBufferView, 22, MAX_32_BITS);
  	} else {
  		setUint32(arrayBufferView, 18, fileEntry.compressedSize);
  		setUint32(arrayBufferView, 22, fileEntry.uncompressedSize);
  	}
  	await writeData(writable, new Uint8Array(arrayBuffer));
  	return entryData.slice(arrayBuffer.byteLength);
  }

  function setZip64ExtraInfo(fileEntry, options) {
  	const { rawExtraFieldZip64, offset, diskNumberStart } = fileEntry;
  	const { zip64UncompressedSize, zip64CompressedSize, zip64Offset, zip64DiskNumberStart } = options;
  	const rawExtraFieldZip64View = getDataView(rawExtraFieldZip64);
  	let rawExtraFieldZip64Offset = 4;
  	if (zip64UncompressedSize) {
  		rawExtraFieldZip64Offset += 8;
  	}
  	if (zip64CompressedSize) {
  		rawExtraFieldZip64Offset += 8;
  	}
  	if (zip64Offset) {
  		setBigUint64(rawExtraFieldZip64View, rawExtraFieldZip64Offset, BigInt(offset));
  		rawExtraFieldZip64Offset += 8;
  	}
  	if (zip64DiskNumberStart) {
  		setUint32(rawExtraFieldZip64View, rawExtraFieldZip64Offset, diskNumberStart);
  	}
  }

  async function closeFile(zipWriter, comment, options) {
  	const { files, writer } = zipWriter;
  	const { diskOffset, writable } = writer;
  	let { diskNumber } = writer;
  	let offset = 0;
  	let directoryDataLength = 0;
  	let directoryOffset = zipWriter.offset - diskOffset;
  	let filesLength = files.size;
  	for (const [, {
  		rawFilename,
  		rawExtraFieldZip64,
  		rawExtraFieldAES,
  		rawExtraField,
  		rawComment,
  		rawExtraFieldExtendedTimestamp,
  		rawExtraFieldNTFS
  	}] of files) {
  		directoryDataLength += 46 +
  			getLength(
  				rawFilename,
  				rawComment,
  				rawExtraFieldZip64,
  				rawExtraFieldAES,
  				rawExtraFieldExtendedTimestamp,
  				rawExtraFieldNTFS,
  				rawExtraField);
  	}
  	const directoryArray = new Uint8Array(directoryDataLength);
  	const directoryView = getDataView(directoryArray);
  	await initStream(writer);
  	let directoryDiskOffset = 0;
  	for (const [indexFileEntry, fileEntry] of Array.from(files.values()).entries()) {
  		const {
  			offset: fileEntryOffset,
  			rawFilename,
  			rawExtraFieldZip64,
  			rawExtraFieldAES,
  			rawExtraFieldNTFS,
  			rawExtraField,
  			rawComment,
  			versionMadeBy,
  			headerArray,
  			directory,
  			zip64,
  			zip64UncompressedSize,
  			zip64CompressedSize,
  			zip64DiskNumberStart,
  			zip64Offset,
  			msDosCompatible,
  			internalFileAttribute,
  			externalFileAttribute,
  			extendedTimestamp,
  			lastModDate,
  			diskNumberStart,
  			uncompressedSize,
  			compressedSize
  		} = fileEntry;
  		let rawExtraFieldExtendedTimestamp;
  		if (extendedTimestamp) {
  			rawExtraFieldExtendedTimestamp = new Uint8Array(9);
  			const extraFieldExtendedTimestampView = getDataView(rawExtraFieldExtendedTimestamp);
  			setUint16(extraFieldExtendedTimestampView, 0, EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP);
  			setUint16(extraFieldExtendedTimestampView, 2, getLength(rawExtraFieldExtendedTimestamp) - 4);
  			setUint8(extraFieldExtendedTimestampView, 4, 0x1);
  			setUint32(extraFieldExtendedTimestampView, 5, Math.floor(lastModDate.getTime() / 1000));
  		} else {
  			rawExtraFieldExtendedTimestamp = new Uint8Array();
  		}
  		const extraFieldLength = getLength(rawExtraFieldZip64, rawExtraFieldAES, rawExtraFieldExtendedTimestamp, rawExtraFieldNTFS, rawExtraField);
  		setUint32(directoryView, offset, CENTRAL_FILE_HEADER_SIGNATURE);
  		setUint16(directoryView, offset + 4, versionMadeBy);
  		const headerView = getDataView(headerArray);
  		if (!zip64UncompressedSize) {
  			setUint32(headerView, 18, uncompressedSize);
  		}
  		if (!zip64CompressedSize) {
  			setUint32(headerView, 14, compressedSize);
  		}
  		arraySet(directoryArray, headerArray, offset + 6);
  		setUint16(directoryView, offset + 30, extraFieldLength);
  		setUint16(directoryView, offset + 32, getLength(rawComment));
  		setUint16(directoryView, offset + 34, zip64 && zip64DiskNumberStart ? MAX_16_BITS : diskNumberStart);
  		setUint16(directoryView, offset + 36, internalFileAttribute);
  		if (externalFileAttribute) {
  			setUint32(directoryView, offset + 38, externalFileAttribute);
  		} else if (directory && msDosCompatible) {
  			setUint8(directoryView, offset + 38, FILE_ATTR_MSDOS_DIR_MASK);
  		}
  		setUint32(directoryView, offset + 42, zip64 && zip64Offset ? MAX_32_BITS : fileEntryOffset);
  		arraySet(directoryArray, rawFilename, offset + 46);
  		arraySet(directoryArray, rawExtraFieldZip64, offset + 46 + getLength(rawFilename));
  		arraySet(directoryArray, rawExtraFieldAES, offset + 46 + getLength(rawFilename, rawExtraFieldZip64));
  		arraySet(directoryArray, rawExtraFieldExtendedTimestamp, offset + 46 + getLength(rawFilename, rawExtraFieldZip64, rawExtraFieldAES));
  		arraySet(directoryArray, rawExtraFieldNTFS, offset + 46 + getLength(rawFilename, rawExtraFieldZip64, rawExtraFieldAES, rawExtraFieldExtendedTimestamp));
  		arraySet(directoryArray, rawExtraField, offset + 46 + getLength(rawFilename, rawExtraFieldZip64, rawExtraFieldAES, rawExtraFieldExtendedTimestamp, rawExtraFieldNTFS));
  		arraySet(directoryArray, rawComment, offset + 46 + getLength(rawFilename) + extraFieldLength);
  		const directoryEntryLength = 46 + getLength(rawFilename, rawComment) + extraFieldLength;
  		if (offset - directoryDiskOffset > writer.availableSize) {
  			writer.availableSize = 0;
  			await writeData(writable, directoryArray.slice(directoryDiskOffset, offset));
  			directoryDiskOffset = offset;
  		}
  		offset += directoryEntryLength;
  		if (options.onprogress) {
  			try {
  				await options.onprogress(indexFileEntry + 1, files.size, new Entry(fileEntry));
  			} catch (_error) {
  				// ignored
  			}
  		}
  	}
  	await writeData(writable, directoryDiskOffset ? directoryArray.slice(directoryDiskOffset) : directoryArray);
  	let lastDiskNumber = writer.diskNumber;
  	const { availableSize } = writer;
  	if (availableSize < END_OF_CENTRAL_DIR_LENGTH) {
  		lastDiskNumber++;
  	}
  	let zip64 = getOptionValue(zipWriter, options, "zip64");
  	if (directoryOffset >= MAX_32_BITS || directoryDataLength >= MAX_32_BITS || filesLength >= MAX_16_BITS || lastDiskNumber >= MAX_16_BITS) {
  		if (zip64 === false) {
  			throw new Error(ERR_UNSUPPORTED_FORMAT);
  		} else {
  			zip64 = true;
  		}
  	}
  	const endOfdirectoryArray = new Uint8Array(zip64 ? ZIP64_END_OF_CENTRAL_DIR_TOTAL_LENGTH : END_OF_CENTRAL_DIR_LENGTH);
  	const endOfdirectoryView = getDataView(endOfdirectoryArray);
  	offset = 0;
  	if (zip64) {
  		setUint32(endOfdirectoryView, 0, ZIP64_END_OF_CENTRAL_DIR_SIGNATURE);
  		setBigUint64(endOfdirectoryView, 4, BigInt(44));
  		setUint16(endOfdirectoryView, 12, 45);
  		setUint16(endOfdirectoryView, 14, 45);
  		setUint32(endOfdirectoryView, 16, lastDiskNumber);
  		setUint32(endOfdirectoryView, 20, diskNumber);
  		setBigUint64(endOfdirectoryView, 24, BigInt(filesLength));
  		setBigUint64(endOfdirectoryView, 32, BigInt(filesLength));
  		setBigUint64(endOfdirectoryView, 40, BigInt(directoryDataLength));
  		setBigUint64(endOfdirectoryView, 48, BigInt(directoryOffset));
  		setUint32(endOfdirectoryView, 56, ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE);
  		setBigUint64(endOfdirectoryView, 64, BigInt(directoryOffset) + BigInt(directoryDataLength));
  		setUint32(endOfdirectoryView, 72, lastDiskNumber + 1);
  		const supportZip64SplitFile = getOptionValue(zipWriter, options, "supportZip64SplitFile", true);
  		if (supportZip64SplitFile) {
  			lastDiskNumber = MAX_16_BITS;
  			diskNumber = MAX_16_BITS;
  		}
  		filesLength = MAX_16_BITS;
  		directoryOffset = MAX_32_BITS;
  		directoryDataLength = MAX_32_BITS;
  		offset += ZIP64_END_OF_CENTRAL_DIR_LENGTH + ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH;
  	}
  	setUint32(endOfdirectoryView, offset, END_OF_CENTRAL_DIR_SIGNATURE);
  	setUint16(endOfdirectoryView, offset + 4, lastDiskNumber);
  	setUint16(endOfdirectoryView, offset + 6, diskNumber);
  	setUint16(endOfdirectoryView, offset + 8, filesLength);
  	setUint16(endOfdirectoryView, offset + 10, filesLength);
  	setUint32(endOfdirectoryView, offset + 12, directoryDataLength);
  	setUint32(endOfdirectoryView, offset + 16, directoryOffset);
  	const commentLength = getLength(comment);
  	if (commentLength) {
  		if (commentLength <= MAX_16_BITS) {
  			setUint16(endOfdirectoryView, offset + 20, commentLength);
  		} else {
  			throw new Error(ERR_INVALID_COMMENT);
  		}
  	}
  	await writeData(writable, endOfdirectoryArray);
  	if (commentLength) {
  		await writeData(writable, comment);
  	}
  }

  function sliceAsArrayBuffer(blob, start, end) {
  	if (start || end) {
  		return blob.slice(start, end).arrayBuffer();
  	} else {
  		return blob.arrayBuffer();
  	}
  }

  async function writeData(writable, array) {
  	const streamWriter = writable.getWriter();
  	await streamWriter.ready;
  	writable.size += getLength(array);
  	await streamWriter.write(array);
  	streamWriter.releaseLock();
  }

  function getTimeNTFS(date) {
  	if (date) {
  		return ((BigInt(date.getTime()) + BigInt(11644473600000)) * BigInt(10000));
  	}
  }

  function getOptionValue(zipWriter, options, name, defaultValue) {
  	const result = options[name] === UNDEFINED_VALUE ? zipWriter.options[name] : options[name];
  	return result === UNDEFINED_VALUE ? defaultValue : result;
  }

  function getMaximumCompressedSize(uncompressedSize) {
  	return uncompressedSize + (5 * (Math.floor(uncompressedSize / 16383) + 1));
  }

  function setUint8(view, offset, value) {
  	view.setUint8(offset, value);
  }

  function setUint16(view, offset, value) {
  	view.setUint16(offset, value, true);
  }

  function setUint32(view, offset, value) {
  	view.setUint32(offset, value, true);
  }

  function setBigUint64(view, offset, value) {
  	view.setBigUint64(offset, value, true);
  }

  function arraySet(array, typedArray, offset) {
  	array.set(typedArray, offset);
  }

  function getDataView(array) {
  	return new DataView(array.buffer);
  }

  function getLength(...arrayLikes) {
  	let result = 0;
  	arrayLikes.forEach(arrayLike => arrayLike && (result += arrayLike.length));
  	return result;
  }

  /*
   Copyright (c) 2022 Gildas Lormeau. All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright 
   notice, this list of conditions and the following disclaimer in 
   the documentation and/or other materials provided with the distribution.

   3. The names of the authors may not be used to endorse or promote products
   derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
   INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
   FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
   INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
   INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
   OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   */

  let baseURL;
  try {
  	baseURL = (typeof document === 'undefined' && typeof location === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : typeof document === 'undefined' ? location.href : (document.currentScript && document.currentScript.src || new URL('app.js', document.baseURI).href));
  } catch (_error) {
  	// ignored
  }
  configure({ baseURL });
  e(configure);

  /// <reference types="./index.d.ts" />

  configure({ Deflate: ZipDeflate, Inflate: ZipInflate });

  var ExportFeatures = {
      exportOffcanvas: null,
      exportSettings: {
          type: 'chaptersjson',
          supportsPretty: false,
          pretty: true,
          hasImages: false,
          canUseImagePrefix: false,
          imagePrefix: '',
          writeRedundantToc: false,
          writeEndTimes: false
      },
      exportContent: '',
      exportData: null,
      initExportDialog() {
          this.exportOffcanvas = new Offcanvas(this.$refs.exportDialog);
          this.$refs.exportDialog.addEventListener('show.bs.offcanvas', () => {
              this.updateExportContent();
          });
      },
      updateExportContent(type) {
          if (type) {
              this.exportSettings.type = type;
          }

          this.data.ensureUniqueFilenames();
          this.exportData = AutoFormat.as(this.exportSettings.type, this.data);
          this.exportSettings.hasImages = this.data.chapters.some(item => item.img && item.img_type === 'blob');
          this.exportSettings.canUseImagePrefix = this.data.chapters.some(item => item.img && ['blob', 'relative'].includes('blob'));

          this.exportSettings.supportsPretty = this.exportData.supportsPrettyPrint;
          this.exportContent = this.exportData.toString(this.exportSettings.pretty, {
              imagePrefix: this.exportSettings.imagePrefix,
              writeRedundantToc: this.exportSettings.writeRedundantToc,
              writeEndTimes: this.exportSettings.writeEndTimes
          });
      },

      download() {
          gtag('event', 'download', this.exportData.constructor.name);

          this.triggerDownload(({
              url: URL.createObjectURL(new Blob([this.exportContent], {type: this.exportData.mimeType})),
              name: this.exportData.filename
          }));
      },

      triggerDownload(options) {
          const a = document.createElement('a');
          a.setAttribute('href', options.url);
          a.setAttribute('download', options.name);
          a.click();
      },

      copyToClipboard() {
          this.$refs.outputTextarea.select();
          document.execCommand('copy');
          window.getSelection()?.removeAllRanges();

          gtag('event', 'copy', this.exportData.constructor.name);

          this.toast('copied to clipboard');
      },

      async downloadZip() {

          gtag('event', 'downloadZip', this.exportData.constructor.name);

          let zipWriter = new ZipWriter(
              new BlobWriter("application/zip"), {bufferedWrite: true}
          );

          await zipWriter.add('chapters.json', new BlobReader(
              new Blob([this.exportContent], {type: 'text/plain'})
          ), {level: 0});

          for (const chapter of this.data.chapters) {
              const response = await fetch(chapter.img);
              const blob = await response.blob();

              await zipWriter.add(chapter.img_filename,
                  new BlobReader(blob),
                  {level: 0});
          }

          const closed = await zipWriter.close();
          this.triggerDownload(({
              url: URL.createObjectURL(closed),
              name: 'chapters.zip'
          }));

          zipWriter = null;
      }
  };

  var ChapterFeatures = {

      chapterDialog: null,
      initChapterDialog() {
          this.chapterDialog = new Offcanvas(this.$refs.chapterDialog);
          this.$refs.chapterDialog.addEventListener('shown.bs.offcanvas', () => {
              gtag('event', 'metaAttributeDialog');
          });
      }
  };

  var ImportDialog = {

      importState : {
          mode : null
      },
      importModal : null,
      initImportDialog(){
          this.importModal = new Modal(this.$refs.importDialog);
      },
      showImportDialog(state){

          this.importState = state;
          this.importModal.show();
      }
  };

  /*! shepherd.js 11.0.1 */

  var isMergeableObject = function isMergeableObject(value) {
    return isNonNullObject(value) && !isSpecial(value);
  };
  function isNonNullObject(value) {
    return !!value && typeof value === 'object';
  }
  function isSpecial(value) {
    var stringValue = Object.prototype.toString.call(value);
    return stringValue === '[object RegExp]' || stringValue === '[object Date]' || isReactElement(value);
  }

  // see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
  var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
  var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;
  function isReactElement(value) {
    return value.$$typeof === REACT_ELEMENT_TYPE;
  }
  function emptyTarget(val) {
    return Array.isArray(val) ? [] : {};
  }
  function cloneUnlessOtherwiseSpecified(value, options) {
    return options.clone !== false && options.isMergeableObject(value) ? deepmerge(emptyTarget(value), value, options) : value;
  }
  function defaultArrayMerge(target, source, options) {
    return target.concat(source).map(function (element) {
      return cloneUnlessOtherwiseSpecified(element, options);
    });
  }
  function getMergeFunction(key, options) {
    if (!options.customMerge) {
      return deepmerge;
    }
    var customMerge = options.customMerge(key);
    return typeof customMerge === 'function' ? customMerge : deepmerge;
  }
  function getEnumerableOwnPropertySymbols(target) {
    return Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(target).filter(function (symbol) {
      return target.propertyIsEnumerable(symbol);
    }) : [];
  }
  function getKeys(target) {
    return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target));
  }
  function propertyIsOnObject(object, property) {
    try {
      return property in object;
    } catch (_) {
      return false;
    }
  }

  // Protects from prototype poisoning and unexpected merging up the prototype chain.
  function propertyIsUnsafe(target, key) {
    return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
    && !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
    && Object.propertyIsEnumerable.call(target, key)); // and also unsafe if they're nonenumerable.
  }

  function mergeObject(target, source, options) {
    var destination = {};
    if (options.isMergeableObject(target)) {
      getKeys(target).forEach(function (key) {
        destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
      });
    }
    getKeys(source).forEach(function (key) {
      if (propertyIsUnsafe(target, key)) {
        return;
      }
      if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
        destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
      } else {
        destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
      }
    });
    return destination;
  }
  function deepmerge(target, source, options) {
    options = options || {};
    options.arrayMerge = options.arrayMerge || defaultArrayMerge;
    options.isMergeableObject = options.isMergeableObject || isMergeableObject;
    // cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
    // implementations can use it. The caller may not replace it.
    options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
    var sourceIsArray = Array.isArray(source);
    var targetIsArray = Array.isArray(target);
    var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;
    if (!sourceAndTargetTypesMatch) {
      return cloneUnlessOtherwiseSpecified(source, options);
    } else if (sourceIsArray) {
      return options.arrayMerge(target, source, options);
    } else {
      return mergeObject(target, source, options);
    }
  }
  deepmerge.all = function deepmergeAll(array, options) {
    if (!Array.isArray(array)) {
      throw new Error('first argument should be an array');
    }
    return array.reduce(function (prev, next) {
      return deepmerge(prev, next, options);
    }, {});
  };
  var deepmerge_1 = deepmerge;
  var cjs = deepmerge_1;

  /**
   * Checks if `value` is classified as an `Element`.
   * @param {*} value The param to check if it is an Element
   */
  function isElement$1(value) {
    return value instanceof Element;
  }

  /**
   * Checks if `value` is classified as an `HTMLElement`.
   * @param {*} value The param to check if it is an HTMLElement
   */
  function isHTMLElement$1(value) {
    return value instanceof HTMLElement;
  }

  /**
   * Checks if `value` is classified as a `Function` object.
   * @param {*} value The param to check if it is a function
   */
  function isFunction(value) {
    return typeof value === 'function';
  }

  /**
   * Checks if `value` is classified as a `String` object.
   * @param {*} value The param to check if it is a string
   */
  function isString(value) {
    return typeof value === 'string';
  }

  /**
   * Checks if `value` is undefined.
   * @param {*} value The param to check if it is undefined
   */
  function isUndefined(value) {
    return value === undefined;
  }

  class Evented {
    on(event, handler, ctx, once) {
      if (once === void 0) {
        once = false;
      }
      if (isUndefined(this.bindings)) {
        this.bindings = {};
      }
      if (isUndefined(this.bindings[event])) {
        this.bindings[event] = [];
      }
      this.bindings[event].push({
        handler,
        ctx,
        once
      });
      return this;
    }
    once(event, handler, ctx) {
      return this.on(event, handler, ctx, true);
    }
    off(event, handler) {
      if (isUndefined(this.bindings) || isUndefined(this.bindings[event])) {
        return this;
      }
      if (isUndefined(handler)) {
        delete this.bindings[event];
      } else {
        this.bindings[event].forEach((binding, index) => {
          if (binding.handler === handler) {
            this.bindings[event].splice(index, 1);
          }
        });
      }
      return this;
    }
    trigger(event) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      if (!isUndefined(this.bindings) && this.bindings[event]) {
        this.bindings[event].forEach((binding, index) => {
          const {
            ctx,
            handler,
            once
          } = binding;
          const context = ctx || this;
          handler.apply(context, args);
          if (once) {
            this.bindings[event].splice(index, 1);
          }
        });
      }
      return this;
    }
  }

  /**
   * Binds all the methods on a JS Class to the `this` context of the class.
   * Adapted from https://github.com/sindresorhus/auto-bind
   * @param {object} self The `this` context of the class
   * @return {object} The `this` context of the class
   */
  function autoBind(self) {
    const keys = Object.getOwnPropertyNames(self.constructor.prototype);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const val = self[key];
      if (key !== 'constructor' && typeof val === 'function') {
        self[key] = val.bind(self);
      }
    }
    return self;
  }

  /**
   * Sets up the handler to determine if we should advance the tour
   * @param {string} selector
   * @param {Step} step The step instance
   * @return {Function}
   * @private
   */
  function _setupAdvanceOnHandler(selector, step) {
    return event => {
      if (step.isOpen()) {
        const targetIsEl = step.el && event.currentTarget === step.el;
        const targetIsSelector = !isUndefined(selector) && event.currentTarget.matches(selector);
        if (targetIsSelector || targetIsEl) {
          step.tour.next();
        }
      }
    };
  }

  /**
   * Bind the event handler for advanceOn
   * @param {Step} step The step instance
   */
  function bindAdvance(step) {
    // An empty selector matches the step element
    const {
      event,
      selector
    } = step.options.advanceOn || {};
    if (event) {
      const handler = _setupAdvanceOnHandler(selector, step);

      // TODO: this should also bind/unbind on show/hide
      let el;
      try {
        el = document.querySelector(selector);
      } catch (e) {
        // TODO
      }
      if (!isUndefined(selector) && !el) {
        return console.error(`No element was found for the selector supplied to advanceOn: ${selector}`);
      } else if (el) {
        el.addEventListener(event, handler);
        step.on('destroy', () => {
          return el.removeEventListener(event, handler);
        });
      } else {
        document.body.addEventListener(event, handler, true);
        step.on('destroy', () => {
          return document.body.removeEventListener(event, handler, true);
        });
      }
    } else {
      return console.error('advanceOn was defined, but no event name was passed.');
    }
  }

  /**
   * Ensure class prefix ends in `-`
   * @param {string} prefix The prefix to prepend to the class names generated by nano-css
   * @return {string} The prefix ending in `-`
   */
  function normalizePrefix(prefix) {
    if (!isString(prefix) || prefix === '') {
      return '';
    }
    return prefix.charAt(prefix.length - 1) !== '-' ? `${prefix}-` : prefix;
  }

  /**
   * Resolves attachTo options, converting element option value to a qualified HTMLElement.
   * @param {Step} step The step instance
   * @returns {{}|{element, on}}
   * `element` is a qualified HTML Element
   * `on` is a string position value
   */
  function parseAttachTo(step) {
    const options = step.options.attachTo || {};
    const returnOpts = Object.assign({}, options);
    if (isFunction(returnOpts.element)) {
      // Bind the callback to step so that it has access to the object, to enable running additional logic
      returnOpts.element = returnOpts.element.call(step);
    }
    if (isString(returnOpts.element)) {
      // Can't override the element in user opts reference because we can't
      // guarantee that the element will exist in the future.
      try {
        returnOpts.element = document.querySelector(returnOpts.element);
      } catch (e) {
        // TODO
      }
      if (!returnOpts.element) {
        console.error(`The element for this Shepherd step was not found ${options.element}`);
      }
    }
    return returnOpts;
  }

  /**
   * Checks if the step should be centered or not. Does not trigger attachTo.element evaluation, making it a pure
   * alternative for the deprecated step.isCentered() method.
   * @param resolvedAttachToOptions
   * @returns {boolean}
   */
  function shouldCenterStep(resolvedAttachToOptions) {
    if (resolvedAttachToOptions === undefined || resolvedAttachToOptions === null) {
      return true;
    }
    return !resolvedAttachToOptions.element || !resolvedAttachToOptions.on;
  }

  /**
   * Create a unique id for steps, tours, modals, etc
   * @return {string}
   */
  function uuid() {
    let d = Date.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c == 'x' ? r : r & 0x3 | 0x8).toString(16);
    });
  }

  function _extends() {
    _extends = Object.assign ? Object.assign.bind() : function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
    return _extends.apply(this, arguments);
  }
  function _objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;
    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }
    return target;
  }

  const _excluded2 = ["mainAxis", "crossAxis", "fallbackPlacements", "fallbackStrategy", "flipAlignment"],
    _excluded4 = ["mainAxis", "crossAxis", "limiter"];
  function getSide(placement) {
    return placement.split('-')[0];
  }
  function getAlignment(placement) {
    return placement.split('-')[1];
  }
  function getMainAxisFromPlacement(placement) {
    return ['top', 'bottom'].includes(getSide(placement)) ? 'x' : 'y';
  }
  function getLengthFromAxis(axis) {
    return axis === 'y' ? 'height' : 'width';
  }
  function computeCoordsFromPlacement(_ref, placement, rtl) {
    let {
      reference,
      floating
    } = _ref;
    const commonX = reference.x + reference.width / 2 - floating.width / 2;
    const commonY = reference.y + reference.height / 2 - floating.height / 2;
    const mainAxis = getMainAxisFromPlacement(placement);
    const length = getLengthFromAxis(mainAxis);
    const commonAlign = reference[length] / 2 - floating[length] / 2;
    const side = getSide(placement);
    const isVertical = mainAxis === 'x';
    let coords;
    switch (side) {
      case 'top':
        coords = {
          x: commonX,
          y: reference.y - floating.height
        };
        break;
      case 'bottom':
        coords = {
          x: commonX,
          y: reference.y + reference.height
        };
        break;
      case 'right':
        coords = {
          x: reference.x + reference.width,
          y: commonY
        };
        break;
      case 'left':
        coords = {
          x: reference.x - floating.width,
          y: commonY
        };
        break;
      default:
        coords = {
          x: reference.x,
          y: reference.y
        };
    }
    switch (getAlignment(placement)) {
      case 'start':
        coords[mainAxis] -= commonAlign * (rtl && isVertical ? -1 : 1);
        break;
      case 'end':
        coords[mainAxis] += commonAlign * (rtl && isVertical ? -1 : 1);
        break;
    }
    return coords;
  }

  /**
   * Computes the `x` and `y` coordinates that will place the floating element
   * next to a reference element when it is given a certain positioning strategy.
   *
   * This export does not have any `platform` interface logic. You will need to
   * write one for the platform you are using Floating UI with.
   */

  const computePosition$1 = async (reference, floating, config) => {
    const {
      placement = 'bottom',
      strategy = 'absolute',
      middleware = [],
      platform
    } = config;
    const validMiddleware = middleware.filter(Boolean);
    const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(floating));
    let rects = await platform.getElementRects({
      reference,
      floating,
      strategy
    });
    let {
      x,
      y
    } = computeCoordsFromPlacement(rects, placement, rtl);
    let statefulPlacement = placement;
    let middlewareData = {};
    let resetCount = 0;
    for (let i = 0; i < validMiddleware.length; i++) {
      const {
        name,
        fn
      } = validMiddleware[i];
      const {
        x: nextX,
        y: nextY,
        data,
        reset
      } = await fn({
        x,
        y,
        initialPlacement: placement,
        placement: statefulPlacement,
        strategy,
        middlewareData,
        rects,
        platform,
        elements: {
          reference,
          floating
        }
      });
      x = nextX != null ? nextX : x;
      y = nextY != null ? nextY : y;
      middlewareData = _extends({}, middlewareData, {
        [name]: _extends({}, middlewareData[name], data)
      });
      if (reset && resetCount <= 50) {
        resetCount++;
        if (typeof reset === 'object') {
          if (reset.placement) {
            statefulPlacement = reset.placement;
          }
          if (reset.rects) {
            rects = reset.rects === true ? await platform.getElementRects({
              reference,
              floating,
              strategy
            }) : reset.rects;
          }
          ({
            x,
            y
          } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
        }
        i = -1;
        continue;
      }
    }
    return {
      x,
      y,
      placement: statefulPlacement,
      strategy,
      middlewareData
    };
  };
  function expandPaddingObject(padding) {
    return _extends({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    }, padding);
  }
  function getSideObjectFromPadding(padding) {
    return typeof padding !== 'number' ? expandPaddingObject(padding) : {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    };
  }
  function rectToClientRect(rect) {
    return _extends({}, rect, {
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height
    });
  }

  /**
   * Resolves with an object of overflow side offsets that determine how much the
   * element is overflowing a given clipping boundary.
   * - positive = overflowing the boundary by that number of pixels
   * - negative = how many pixels left before it will overflow
   * - 0 = lies flush with the boundary
   * @see https://floating-ui.com/docs/detectOverflow
   */
  async function detectOverflow(middlewareArguments, options) {
    var _await$platform$isEle;
    if (options === void 0) {
      options = {};
    }
    const {
      x,
      y,
      platform,
      rects,
      elements,
      strategy
    } = middlewareArguments;
    const {
      boundary = 'clippingAncestors',
      rootBoundary = 'viewport',
      elementContext = 'floating',
      altBoundary = false,
      padding = 0
    } = options;
    const paddingObject = getSideObjectFromPadding(padding);
    const altContext = elementContext === 'floating' ? 'reference' : 'floating';
    const element = elements[altBoundary ? altContext : elementContext];
    const clippingClientRect = rectToClientRect(await platform.getClippingRect({
      element: ((_await$platform$isEle = await (platform.isElement == null ? void 0 : platform.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || (await (platform.getDocumentElement == null ? void 0 : platform.getDocumentElement(elements.floating))),
      boundary,
      rootBoundary,
      strategy
    }));
    const rect = elementContext === 'floating' ? _extends({}, rects.floating, {
      x,
      y
    }) : rects.reference;
    const offsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(elements.floating));
    const offsetScale = (await (platform.isElement == null ? void 0 : platform.isElement(offsetParent))) ? (await (platform.getScale == null ? void 0 : platform.getScale(offsetParent))) || {
      x: 1,
      y: 1
    } : {
      x: 1,
      y: 1
    };
    const elementClientRect = rectToClientRect(platform.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform.convertOffsetParentRelativeRectToViewportRelativeRect({
      rect,
      offsetParent,
      strategy
    }) : rect);
    return {
      top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
      bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
      left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
      right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
    };
  }
  const min$1 = Math.min;
  const max$1 = Math.max;
  function within(min$1$1, value, max$1$1) {
    return max$1(min$1$1, min$1(value, max$1$1));
  }

  /**
   * Positions an inner element of the floating element such that it is centered
   * to the reference element.
   * @see https://floating-ui.com/docs/arrow
   */
  const arrow = options => ({
    name: 'arrow',
    options,
    async fn(middlewareArguments) {
      // Since `element` is required, we don't Partial<> the type
      const {
        element,
        padding = 0
      } = options != null ? options : {};
      const {
        x,
        y,
        placement,
        rects,
        platform
      } = middlewareArguments;
      if (element == null) {
        return {};
      }
      const paddingObject = getSideObjectFromPadding(padding);
      const coords = {
        x,
        y
      };
      const axis = getMainAxisFromPlacement(placement);
      const alignment = getAlignment(placement);
      const length = getLengthFromAxis(axis);
      const arrowDimensions = await platform.getDimensions(element);
      const minProp = axis === 'y' ? 'top' : 'left';
      const maxProp = axis === 'y' ? 'bottom' : 'right';
      const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
      const startDiff = coords[axis] - rects.reference[axis];
      const arrowOffsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(element));
      let clientSize = arrowOffsetParent ? axis === 'y' ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
      if (clientSize === 0) {
        clientSize = rects.floating[length];
      }
      const centerToReference = endDiff / 2 - startDiff / 2; // Make sure the arrow doesn't overflow the floating element if the center
      // point is outside the floating element's bounds

      const min = paddingObject[minProp];
      const max = clientSize - arrowDimensions[length] - paddingObject[maxProp];
      const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
      const offset = within(min, center, max); // Make sure that arrow points at the reference

      const alignmentPadding = alignment === 'start' ? paddingObject[minProp] : paddingObject[maxProp];
      const shouldAddOffset = alignmentPadding > 0 && center !== offset && rects.reference[length] <= rects.floating[length];
      const alignmentOffset = shouldAddOffset ? center < min ? min - center : max - center : 0;
      return {
        [axis]: coords[axis] - alignmentOffset,
        data: {
          [axis]: offset,
          centerOffset: center - offset
        }
      };
    }
  });
  const hash$1 = {
    left: 'right',
    right: 'left',
    bottom: 'top',
    top: 'bottom'
  };
  function getOppositePlacement(placement) {
    return placement.replace(/left|right|bottom|top/g, matched => hash$1[matched]);
  }
  function getAlignmentSides(placement, rects, rtl) {
    if (rtl === void 0) {
      rtl = false;
    }
    const alignment = getAlignment(placement);
    const mainAxis = getMainAxisFromPlacement(placement);
    const length = getLengthFromAxis(mainAxis);
    let mainAlignmentSide = mainAxis === 'x' ? alignment === (rtl ? 'end' : 'start') ? 'right' : 'left' : alignment === 'start' ? 'bottom' : 'top';
    if (rects.reference[length] > rects.floating[length]) {
      mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
    }
    return {
      main: mainAlignmentSide,
      cross: getOppositePlacement(mainAlignmentSide)
    };
  }
  const hash = {
    start: 'end',
    end: 'start'
  };
  function getOppositeAlignmentPlacement(placement) {
    return placement.replace(/start|end/g, matched => hash[matched]);
  }
  function getExpandedPlacements(placement) {
    const oppositePlacement = getOppositePlacement(placement);
    return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
  }

  /**
   * Changes the placement of the floating element to one that will fit if the
   * initially specified `placement` does not.
   * @see https://floating-ui.com/docs/flip
   */
  const flip = function flip(options) {
    if (options === void 0) {
      options = {};
    }
    return {
      name: 'flip',
      options,
      async fn(middlewareArguments) {
        var _middlewareData$flip;
        const {
          placement,
          middlewareData,
          rects,
          initialPlacement,
          platform,
          elements
        } = middlewareArguments;
        const {
            mainAxis: checkMainAxis = true,
            crossAxis: checkCrossAxis = true,
            fallbackPlacements: specifiedFallbackPlacements,
            fallbackStrategy = 'bestFit',
            flipAlignment = true
          } = options,
          detectOverflowOptions = _objectWithoutPropertiesLoose(options, _excluded2);
        const side = getSide(placement);
        const isBasePlacement = side === initialPlacement;
        const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
        const placements = [initialPlacement, ...fallbackPlacements];
        const overflow = await detectOverflow(middlewareArguments, detectOverflowOptions);
        const overflows = [];
        let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
        if (checkMainAxis) {
          overflows.push(overflow[side]);
        }
        if (checkCrossAxis) {
          const {
            main,
            cross
          } = getAlignmentSides(placement, rects, await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating)));
          overflows.push(overflow[main], overflow[cross]);
        }
        overflowsData = [...overflowsData, {
          placement,
          overflows
        }]; // One or more sides is overflowing

        if (!overflows.every(side => side <= 0)) {
          var _middlewareData$flip$, _middlewareData$flip2;
          const nextIndex = ((_middlewareData$flip$ = (_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) != null ? _middlewareData$flip$ : 0) + 1;
          const nextPlacement = placements[nextIndex];
          if (nextPlacement) {
            // Try next placement and re-run the lifecycle
            return {
              data: {
                index: nextIndex,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
          let resetPlacement = 'bottom';
          switch (fallbackStrategy) {
            case 'bestFit':
              {
                var _overflowsData$map$so;
                const placement = (_overflowsData$map$so = overflowsData.map(d => [d, d.overflows.filter(overflow => overflow > 0).reduce((acc, overflow) => acc + overflow, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$map$so[0].placement;
                if (placement) {
                  resetPlacement = placement;
                }
                break;
              }
            case 'initialPlacement':
              resetPlacement = initialPlacement;
              break;
          }
          if (placement !== resetPlacement) {
            return {
              reset: {
                placement: resetPlacement
              }
            };
          }
        }
        return {};
      }
    };
  };
  function getCrossAxis(axis) {
    return axis === 'x' ? 'y' : 'x';
  }

  /**
   * Shifts the floating element in order to keep it in view when it will overflow
   * a clipping boundary.
   * @see https://floating-ui.com/docs/shift
   */
  const shift = function shift(options) {
    if (options === void 0) {
      options = {};
    }
    return {
      name: 'shift',
      options,
      async fn(middlewareArguments) {
        const {
          x,
          y,
          placement
        } = middlewareArguments;
        const {
            mainAxis: checkMainAxis = true,
            crossAxis: checkCrossAxis = false,
            limiter = {
              fn: _ref => {
                let {
                  x,
                  y
                } = _ref;
                return {
                  x,
                  y
                };
              }
            }
          } = options,
          detectOverflowOptions = _objectWithoutPropertiesLoose(options, _excluded4);
        const coords = {
          x,
          y
        };
        const overflow = await detectOverflow(middlewareArguments, detectOverflowOptions);
        const mainAxis = getMainAxisFromPlacement(getSide(placement));
        const crossAxis = getCrossAxis(mainAxis);
        let mainAxisCoord = coords[mainAxis];
        let crossAxisCoord = coords[crossAxis];
        if (checkMainAxis) {
          const minSide = mainAxis === 'y' ? 'top' : 'left';
          const maxSide = mainAxis === 'y' ? 'bottom' : 'right';
          const min = mainAxisCoord + overflow[minSide];
          const max = mainAxisCoord - overflow[maxSide];
          mainAxisCoord = within(min, mainAxisCoord, max);
        }
        if (checkCrossAxis) {
          const minSide = crossAxis === 'y' ? 'top' : 'left';
          const maxSide = crossAxis === 'y' ? 'bottom' : 'right';
          const min = crossAxisCoord + overflow[minSide];
          const max = crossAxisCoord - overflow[maxSide];
          crossAxisCoord = within(min, crossAxisCoord, max);
        }
        const limitedCoords = limiter.fn(_extends({}, middlewareArguments, {
          [mainAxis]: mainAxisCoord,
          [crossAxis]: crossAxisCoord
        }));
        return _extends({}, limitedCoords, {
          data: {
            x: limitedCoords.x - x,
            y: limitedCoords.y - y
          }
        });
      }
    };
  };

  /**
   * Built-in `limiter` that will stop `shift()` at a certain point.
   */
  const limitShift = function limitShift(options) {
    if (options === void 0) {
      options = {};
    }
    return {
      options,
      fn(middlewareArguments) {
        const {
          x,
          y,
          placement,
          rects,
          middlewareData
        } = middlewareArguments;
        const {
          offset = 0,
          mainAxis: checkMainAxis = true,
          crossAxis: checkCrossAxis = true
        } = options;
        const coords = {
          x,
          y
        };
        const mainAxis = getMainAxisFromPlacement(placement);
        const crossAxis = getCrossAxis(mainAxis);
        let mainAxisCoord = coords[mainAxis];
        let crossAxisCoord = coords[crossAxis];
        const rawOffset = typeof offset === 'function' ? offset(middlewareArguments) : offset;
        const computedOffset = typeof rawOffset === 'number' ? {
          mainAxis: rawOffset,
          crossAxis: 0
        } : _extends({
          mainAxis: 0,
          crossAxis: 0
        }, rawOffset);
        if (checkMainAxis) {
          const len = mainAxis === 'y' ? 'height' : 'width';
          const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
          const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
          if (mainAxisCoord < limitMin) {
            mainAxisCoord = limitMin;
          } else if (mainAxisCoord > limitMax) {
            mainAxisCoord = limitMax;
          }
        }
        if (checkCrossAxis) {
          var _middlewareData$offse, _middlewareData$offse2, _middlewareData$offse3, _middlewareData$offse4;
          const len = mainAxis === 'y' ? 'width' : 'height';
          const isOriginSide = ['top', 'left'].includes(getSide(placement));
          const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? (_middlewareData$offse = (_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) != null ? _middlewareData$offse : 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
          const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : (_middlewareData$offse3 = (_middlewareData$offse4 = middlewareData.offset) == null ? void 0 : _middlewareData$offse4[crossAxis]) != null ? _middlewareData$offse3 : 0) - (isOriginSide ? computedOffset.crossAxis : 0);
          if (crossAxisCoord < limitMin) {
            crossAxisCoord = limitMin;
          } else if (crossAxisCoord > limitMax) {
            crossAxisCoord = limitMax;
          }
        }
        return {
          [mainAxis]: mainAxisCoord,
          [crossAxis]: crossAxisCoord
        };
      }
    };
  };

  function getWindow(node) {
    var _node$ownerDocument;
    return ((_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
  }
  function getComputedStyle$1(element) {
    return getWindow(element).getComputedStyle(element);
  }
  function getNodeName(node) {
    return isNode(node) ? (node.nodeName || '').toLowerCase() : '';
  }
  let uaString;
  function getUAString() {
    if (uaString) {
      return uaString;
    }
    const uaData = navigator.userAgentData;
    if (uaData && Array.isArray(uaData.brands)) {
      uaString = uaData.brands.map(item => item.brand + "/" + item.version).join(' ');
      return uaString;
    }
    return navigator.userAgent;
  }
  function isHTMLElement(value) {
    return value instanceof getWindow(value).HTMLElement;
  }
  function isElement(value) {
    return value instanceof getWindow(value).Element;
  }
  function isNode(value) {
    return value instanceof getWindow(value).Node;
  }
  function isShadowRoot(node) {
    // Browsers without `ShadowRoot` support
    if (typeof ShadowRoot === 'undefined') {
      return false;
    }
    const OwnElement = getWindow(node).ShadowRoot;
    return node instanceof OwnElement || node instanceof ShadowRoot;
  }
  function isOverflowElement(element) {
    // Firefox wants us to check `-x` and `-y` variations as well
    const {
      overflow,
      overflowX,
      overflowY,
      display
    } = getComputedStyle$1(element);
    return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX) && !['inline', 'contents'].includes(display);
  }
  function isTableElement(element) {
    return ['table', 'td', 'th'].includes(getNodeName(element));
  }
  function isContainingBlock(element) {
    // TODO: Try and use feature detection here instead
    const isFirefox = /firefox/i.test(getUAString());
    const css = getComputedStyle$1(element);
    const backdropFilter = css.backdropFilter || css.WebkitBackdropFilter; // This is non-exhaustive but covers the most common CSS properties that
    // create a containing block.
    // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block

    return css.transform !== 'none' || css.perspective !== 'none' || (backdropFilter ? backdropFilter !== 'none' : false) || isFirefox && css.willChange === 'filter' || isFirefox && (css.filter ? css.filter !== 'none' : false) || ['transform', 'perspective'].some(value => css.willChange.includes(value)) || ['paint', 'layout', 'strict', 'content'].some(
    // TS 4.1 compat
    value => {
      const contain = css.contain;
      return contain != null ? contain.includes(value) : false;
    });
  }
  function isLayoutViewport() {
    // Not Safari
    return !/^((?!chrome|android).)*safari/i.test(getUAString()); // Feature detection for this fails in various ways
    // • Always-visible scrollbar or not
    // • Width of <html>, etc.
    // const vV = win.visualViewport;
    // return vV ? Math.abs(win.innerWidth / vV.scale - vV.width) < 0.5 : true;
  }

  function isLastTraversableNode(node) {
    return ['html', 'body', '#document'].includes(getNodeName(node));
  }
  const FALLBACK_SCALE = {
    x: 1,
    y: 1
  };
  function getScale(element) {
    const domElement = !isElement(element) && element.contextElement ? element.contextElement : isElement(element) ? element : null;
    if (!domElement) {
      return FALLBACK_SCALE;
    }
    const rect = domElement.getBoundingClientRect();
    const css = getComputedStyle$1(domElement);
    let x = rect.width / parseFloat(css.width);
    let y = rect.height / parseFloat(css.height); // 0, NaN, or Infinity should always fallback to 1.

    if (!x || !Number.isFinite(x)) {
      x = 1;
    }
    if (!y || !Number.isFinite(y)) {
      y = 1;
    }
    return {
      x,
      y
    };
  }
  function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
    var _win$visualViewport$o, _win$visualViewport, _win$visualViewport$o2, _win$visualViewport2;
    if (includeScale === void 0) {
      includeScale = false;
    }
    if (isFixedStrategy === void 0) {
      isFixedStrategy = false;
    }
    const clientRect = element.getBoundingClientRect();
    let scale = FALLBACK_SCALE;
    if (includeScale) {
      if (offsetParent) {
        if (isElement(offsetParent)) {
          scale = getScale(offsetParent);
        }
      } else {
        scale = getScale(element);
      }
    }
    const win = isElement(element) ? getWindow(element) : window;
    const addVisualOffsets = !isLayoutViewport() && isFixedStrategy;
    const x = (clientRect.left + (addVisualOffsets ? (_win$visualViewport$o = (_win$visualViewport = win.visualViewport) == null ? void 0 : _win$visualViewport.offsetLeft) != null ? _win$visualViewport$o : 0 : 0)) / scale.x;
    const y = (clientRect.top + (addVisualOffsets ? (_win$visualViewport$o2 = (_win$visualViewport2 = win.visualViewport) == null ? void 0 : _win$visualViewport2.offsetTop) != null ? _win$visualViewport$o2 : 0 : 0)) / scale.y;
    const width = clientRect.width / scale.x;
    const height = clientRect.height / scale.y;
    return {
      width,
      height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x,
      x,
      y
    };
  }
  function getDocumentElement(node) {
    return ((isNode(node) ? node.ownerDocument : node.document) || window.document).documentElement;
  }
  function getNodeScroll(element) {
    if (isElement(element)) {
      return {
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop
      };
    }
    return {
      scrollLeft: element.pageXOffset,
      scrollTop: element.pageYOffset
    };
  }
  function getWindowScrollBarX(element) {
    // If <html> has a CSS width greater than the viewport, then this will be
    // incorrect for RTL.
    return getBoundingClientRect(getDocumentElement(element)).left + getNodeScroll(element).scrollLeft;
  }
  function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
    const isOffsetParentAnElement = isHTMLElement(offsetParent);
    const documentElement = getDocumentElement(offsetParent);
    const rect = getBoundingClientRect(element, true, strategy === 'fixed', offsetParent);
    let scroll = {
      scrollLeft: 0,
      scrollTop: 0
    };
    const offsets = {
      x: 0,
      y: 0
    };
    if (isOffsetParentAnElement || !isOffsetParentAnElement && strategy !== 'fixed') {
      if (getNodeName(offsetParent) !== 'body' || isOverflowElement(documentElement)) {
        scroll = getNodeScroll(offsetParent);
      }
      if (isHTMLElement(offsetParent)) {
        const offsetRect = getBoundingClientRect(offsetParent, true);
        offsets.x = offsetRect.x + offsetParent.clientLeft;
        offsets.y = offsetRect.y + offsetParent.clientTop;
      } else if (documentElement) {
        offsets.x = getWindowScrollBarX(documentElement);
      }
    }
    return {
      x: rect.left + scroll.scrollLeft - offsets.x,
      y: rect.top + scroll.scrollTop - offsets.y,
      width: rect.width,
      height: rect.height
    };
  }
  function getParentNode(node) {
    if (getNodeName(node) === 'html') {
      return node;
    }
    const result =
    // Step into the shadow DOM of the parent of a slotted node
    node.assignedSlot ||
    // DOM Element detected
    node.parentNode || (
    // ShadowRoot detected
    isShadowRoot(node) ? node.host : null) ||
    // Fallback
    getDocumentElement(node);
    return isShadowRoot(result) ? result.host : result;
  }
  function getTrueOffsetParent(element) {
    if (!isHTMLElement(element) || getComputedStyle$1(element).position === 'fixed') {
      return null;
    }
    return element.offsetParent;
  }
  function getContainingBlock(element) {
    let currentNode = getParentNode(element);
    while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
      if (isContainingBlock(currentNode)) {
        return currentNode;
      } else {
        currentNode = getParentNode(currentNode);
      }
    }
    return null;
  } // Gets the closest ancestor positioned element. Handles some edge cases,
  // such as table ancestors and cross browser bugs.

  function getOffsetParent(element) {
    const window = getWindow(element);
    let offsetParent = getTrueOffsetParent(element);
    while (offsetParent && isTableElement(offsetParent) && getComputedStyle$1(offsetParent).position === 'static') {
      offsetParent = getTrueOffsetParent(offsetParent);
    }
    if (offsetParent && (getNodeName(offsetParent) === 'html' || getNodeName(offsetParent) === 'body' && getComputedStyle$1(offsetParent).position === 'static' && !isContainingBlock(offsetParent))) {
      return window;
    }
    return offsetParent || getContainingBlock(element) || window;
  }
  function getDimensions(element) {
    if (isHTMLElement(element)) {
      return {
        width: element.offsetWidth,
        height: element.offsetHeight
      };
    }
    const rect = getBoundingClientRect(element);
    return {
      width: rect.width,
      height: rect.height
    };
  }
  function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
    let {
      rect,
      offsetParent,
      strategy
    } = _ref;
    const isOffsetParentAnElement = isHTMLElement(offsetParent);
    const documentElement = getDocumentElement(offsetParent);
    if (offsetParent === documentElement) {
      return rect;
    }
    let scroll = {
      scrollLeft: 0,
      scrollTop: 0
    };
    let scale = {
      x: 1,
      y: 1
    };
    const offsets = {
      x: 0,
      y: 0
    };
    if (isOffsetParentAnElement || !isOffsetParentAnElement && strategy !== 'fixed') {
      if (getNodeName(offsetParent) !== 'body' || isOverflowElement(documentElement)) {
        scroll = getNodeScroll(offsetParent);
      }
      if (isHTMLElement(offsetParent)) {
        const offsetRect = getBoundingClientRect(offsetParent);
        scale = getScale(offsetParent);
        offsets.x = offsetRect.x + offsetParent.clientLeft;
        offsets.y = offsetRect.y + offsetParent.clientTop;
      } // This doesn't appear to need to be negated.
      // else if (documentElement) {
      //   offsets.x = getWindowScrollBarX(documentElement);
      // }
    }

    return {
      width: rect.width * scale.x,
      height: rect.height * scale.y,
      x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x,
      y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y
    };
  }
  function getViewportRect(element, strategy) {
    const win = getWindow(element);
    const html = getDocumentElement(element);
    const visualViewport = win.visualViewport;
    let width = html.clientWidth;
    let height = html.clientHeight;
    let x = 0;
    let y = 0;
    if (visualViewport) {
      width = visualViewport.width;
      height = visualViewport.height;
      const layoutViewport = isLayoutViewport();
      if (layoutViewport || !layoutViewport && strategy === 'fixed') {
        x = visualViewport.offsetLeft;
        y = visualViewport.offsetTop;
      }
    }
    return {
      width,
      height,
      x,
      y
    };
  }
  const min = Math.min;
  const max = Math.max;

  // of the `<html>` and `<body>` rect bounds if horizontally scrollable

  function getDocumentRect(element) {
    var _element$ownerDocumen;
    const html = getDocumentElement(element);
    const scroll = getNodeScroll(element);
    const body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
    const width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
    const height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
    let x = -scroll.scrollLeft + getWindowScrollBarX(element);
    const y = -scroll.scrollTop;
    if (getComputedStyle$1(body || html).direction === 'rtl') {
      x += max(html.clientWidth, body ? body.clientWidth : 0) - width;
    }
    return {
      width,
      height,
      x,
      y
    };
  }
  function getNearestOverflowAncestor(node) {
    const parentNode = getParentNode(node);
    if (isLastTraversableNode(parentNode)) {
      // @ts-ignore assume body is always available
      return node.ownerDocument.body;
    }
    if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
      return parentNode;
    }
    return getNearestOverflowAncestor(parentNode);
  }
  function getOverflowAncestors(node, list) {
    var _node$ownerDocument;
    if (list === void 0) {
      list = [];
    }
    const scrollableAncestor = getNearestOverflowAncestor(node);
    const isBody = scrollableAncestor === ((_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.body);
    const win = getWindow(scrollableAncestor);
    if (isBody) {
      return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : []);
    }
    return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor));
  }

  // Returns the inner client rect, subtracting scrollbars if present
  function getInnerBoundingClientRect(element, strategy) {
    const clientRect = getBoundingClientRect(element, true, strategy === 'fixed');
    const top = clientRect.top + element.clientTop;
    const left = clientRect.left + element.clientLeft;
    const scale = isHTMLElement(element) ? getScale(element) : {
      x: 1,
      y: 1
    };
    const width = element.clientWidth * scale.x;
    const height = element.clientHeight * scale.y;
    const x = left * scale.x;
    const y = top * scale.y;
    return {
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
      x,
      y,
      width,
      height
    };
  }
  function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
    if (clippingAncestor === 'viewport') {
      return rectToClientRect(getViewportRect(element, strategy));
    }
    if (isElement(clippingAncestor)) {
      return getInnerBoundingClientRect(clippingAncestor, strategy);
    }
    return rectToClientRect(getDocumentRect(getDocumentElement(element)));
  } // A "clipping ancestor" is an `overflow` element with the characteristic of
  // clipping (or hiding) child elements. This returns all clipping ancestors
  // of the given element up the tree.

  function getClippingElementAncestors(element, cache) {
    const cachedResult = cache.get(element);
    if (cachedResult) {
      return cachedResult;
    }
    let result = getOverflowAncestors(element).filter(el => isElement(el) && getNodeName(el) !== 'body');
    let currentContainingBlockComputedStyle = null;
    const elementIsFixed = getComputedStyle$1(element).position === 'fixed';
    let currentNode = elementIsFixed ? getParentNode(element) : element; // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block

    while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
      const computedStyle = getComputedStyle$1(currentNode);
      const containingBlock = isContainingBlock(currentNode);
      const shouldDropCurrentNode = elementIsFixed ? !containingBlock && !currentContainingBlockComputedStyle : !containingBlock && computedStyle.position === 'static' && !!currentContainingBlockComputedStyle && ['absolute', 'fixed'].includes(currentContainingBlockComputedStyle.position);
      if (shouldDropCurrentNode) {
        // Drop non-containing blocks
        result = result.filter(ancestor => ancestor !== currentNode);
      } else {
        // Record last containing block for next iteration
        currentContainingBlockComputedStyle = computedStyle;
      }
      currentNode = getParentNode(currentNode);
    }
    cache.set(element, result);
    return result;
  } // Gets the maximum area that the element is visible in due to any number of
  // clipping ancestors

  function getClippingRect(_ref) {
    let {
      element,
      boundary,
      rootBoundary,
      strategy
    } = _ref;
    const elementClippingAncestors = boundary === 'clippingAncestors' ? getClippingElementAncestors(element, this._c) : [].concat(boundary);
    const clippingAncestors = [...elementClippingAncestors, rootBoundary];
    const firstClippingAncestor = clippingAncestors[0];
    const clippingRect = clippingAncestors.reduce((accRect, clippingAncestor) => {
      const rect = getClientRectFromClippingAncestor(element, clippingAncestor, strategy);
      accRect.top = max(rect.top, accRect.top);
      accRect.right = min(rect.right, accRect.right);
      accRect.bottom = min(rect.bottom, accRect.bottom);
      accRect.left = max(rect.left, accRect.left);
      return accRect;
    }, getClientRectFromClippingAncestor(element, firstClippingAncestor, strategy));
    return {
      width: clippingRect.right - clippingRect.left,
      height: clippingRect.bottom - clippingRect.top,
      x: clippingRect.left,
      y: clippingRect.top
    };
  }
  const platform = {
    getClippingRect,
    convertOffsetParentRelativeRectToViewportRelativeRect,
    isElement,
    getDimensions,
    getOffsetParent,
    getDocumentElement,
    getScale,
    async getElementRects(_ref) {
      let {
        reference,
        floating,
        strategy
      } = _ref;
      const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
      const getDimensionsFn = this.getDimensions;
      return {
        reference: getRectRelativeToOffsetParent(reference, await getOffsetParentFn(floating), strategy),
        floating: _extends({
          x: 0,
          y: 0
        }, await getDimensionsFn(floating))
      };
    },
    getClientRects: element => Array.from(element.getClientRects()),
    isRTL: element => getComputedStyle$1(element).direction === 'rtl'
  };

  /**
   * Automatically updates the position of the floating element when necessary.
   * @see https://floating-ui.com/docs/autoUpdate
   */
  function autoUpdate(reference, floating, update, options) {
    if (options === void 0) {
      options = {};
    }
    const {
      ancestorScroll: _ancestorScroll = true,
      ancestorResize = true,
      elementResize = true,
      animationFrame = false
    } = options;
    const ancestorScroll = _ancestorScroll && !animationFrame;
    const ancestors = ancestorScroll || ancestorResize ? [...(isElement(reference) ? getOverflowAncestors(reference) : reference.contextElement ? getOverflowAncestors(reference.contextElement) : []), ...getOverflowAncestors(floating)] : [];
    ancestors.forEach(ancestor => {
      ancestorScroll && ancestor.addEventListener('scroll', update, {
        passive: true
      });
      ancestorResize && ancestor.addEventListener('resize', update);
    });
    let observer = null;
    if (elementResize) {
      let initialUpdate = true;
      observer = new ResizeObserver(() => {
        if (!initialUpdate) {
          update();
        }
        initialUpdate = false;
      });
      isElement(reference) && !animationFrame && observer.observe(reference);
      if (!isElement(reference) && reference.contextElement && !animationFrame) {
        observer.observe(reference.contextElement);
      }
      observer.observe(floating);
    }
    let frameId;
    let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
    if (animationFrame) {
      frameLoop();
    }
    function frameLoop() {
      const nextRefRect = getBoundingClientRect(reference);
      if (prevRefRect && (nextRefRect.x !== prevRefRect.x || nextRefRect.y !== prevRefRect.y || nextRefRect.width !== prevRefRect.width || nextRefRect.height !== prevRefRect.height)) {
        update();
      }
      prevRefRect = nextRefRect;
      frameId = requestAnimationFrame(frameLoop);
    }
    update();
    return () => {
      var _observer;
      ancestors.forEach(ancestor => {
        ancestorScroll && ancestor.removeEventListener('scroll', update);
        ancestorResize && ancestor.removeEventListener('resize', update);
      });
      (_observer = observer) == null ? void 0 : _observer.disconnect();
      observer = null;
      if (animationFrame) {
        cancelAnimationFrame(frameId);
      }
    };
  }

  /**
   * Computes the `x` and `y` coordinates that will place the floating element
   * next to a reference element when it is given a certain CSS positioning
   * strategy.
   */

  const computePosition = (reference, floating, options) => {
    // This caches the expensive `getClippingElementAncestors` function so that
    // multiple lifecycle resets re-use the same result. It only lives for a
    // single call. If other functions become expensive, we can add them as well.
    const cache = new Map();
    const mergedOptions = _extends({
      platform
    }, options);
    const platformWithCache = _extends({}, mergedOptions.platform, {
      _c: cache
    });
    return computePosition$1(reference, floating, _extends({}, mergedOptions, {
      platform: platformWithCache
    }));
  };

  /**
   * Floating UI Options
   *
   * @typedef {object} FloatingUIOptions
   */

  /**
   * Determines options for the tooltip and initializes event listeners.
   *
   * @param {Step} step The step instance
   *
   * @return {FloatingUIOptions}
   */
  function setupTooltip(step) {
    if (step.cleanup) {
      step.cleanup();
    }
    const attachToOptions = step._getResolvedAttachToOptions();
    let target = attachToOptions.element;
    const floatingUIOptions = getFloatingUIOptions(attachToOptions, step);
    const shouldCenter = shouldCenterStep(attachToOptions);
    if (shouldCenter) {
      target = document.body;
      const content = step.shepherdElementComponent.getElement();
      content.classList.add('shepherd-centered');
    }
    step.cleanup = autoUpdate(target, step.el, () => {
      // The element might have already been removed by the end of the tour.
      if (!step.el) {
        step.cleanup();
        return;
      }
      setPosition(target, step, floatingUIOptions, shouldCenter);
    });
    step.target = attachToOptions.element;
    return floatingUIOptions;
  }

  /**
   * Merge tooltip options handling nested keys.
   *
   * @param tourOptions - The default tour options.
   * @param options - Step specific options.
   *
   * @return {floatingUIOptions: FloatingUIOptions}
   */
  function mergeTooltipConfig(tourOptions, options) {
    return {
      floatingUIOptions: cjs(tourOptions.floatingUIOptions || {}, options.floatingUIOptions || {})
    };
  }

  /**
   * Cleanup function called when the step is closed/destroyed.
   *
   * @param {Step} step
   */
  function destroyTooltip(step) {
    if (step.cleanup) {
      step.cleanup();
    }
    step.cleanup = null;
  }

  /**
   *
   * @return {Promise<*>}
   */
  function setPosition(target, step, floatingUIOptions, shouldCenter) {
    return computePosition(target, step.el, floatingUIOptions).then(floatingUIposition(step, shouldCenter))
    // Wait before forcing focus.
    .then(step => new Promise(resolve => {
      setTimeout(() => resolve(step), 300);
    }))
    // Replaces focusAfterRender modifier.
    .then(step => {
      if (step && step.el) {
        step.el.focus({
          preventScroll: true
        });
      }
    });
  }

  /**
   *
   * @param step
   * @param shouldCenter
   * @return {function({x: *, y: *, placement: *, middlewareData: *}): Promise<unknown>}
   */
  function floatingUIposition(step, shouldCenter) {
    return _ref => {
      let {
        x,
        y,
        placement,
        middlewareData
      } = _ref;
      if (!step.el) {
        return step;
      }
      if (shouldCenter) {
        Object.assign(step.el.style, {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        });
      } else {
        Object.assign(step.el.style, {
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`
        });
      }
      step.el.dataset.popperPlacement = placement;
      placeArrow(step.el, middlewareData);
      return step;
    };
  }

  /**
   *
   * @param el
   * @param middlewareData
   */
  function placeArrow(el, middlewareData) {
    const arrowEl = el.querySelector('.shepherd-arrow');
    if (arrowEl) {
      let left, top, right, bottom;
      if (middlewareData.arrow) {
        const {
          x: arrowX,
          y: arrowY
        } = middlewareData.arrow;
        left = arrowX != null ? `${arrowX}px` : '';
        top = arrowY != null ? `${arrowY}px` : '';
      }
      Object.assign(arrowEl.style, {
        left,
        top,
        right,
        bottom
      });
    }
  }

  /**
   * Gets the `Floating UI` options from a set of base `attachTo` options
   * @param attachToOptions
   * @param {Step} step The step instance
   * @return {Object}
   * @private
   */
  function getFloatingUIOptions(attachToOptions, step) {
    const options = {
      strategy: 'absolute',
      middleware: []
    };
    const arrowEl = addArrow(step);
    const shouldCenter = shouldCenterStep(attachToOptions);
    if (!shouldCenter) {
      options.middleware.push(flip(),
      // Replicate PopperJS default behavior.
      shift({
        limiter: limitShift(),
        crossAxis: true
      }));
      if (arrowEl) {
        options.middleware.push(arrow({
          element: arrowEl
        }));
      }
      options.placement = attachToOptions.on;
    }
    return cjs(step.options.floatingUIOptions || {}, options);
  }

  /**
   * @param {Step} step
   * @return {HTMLElement|false|null}
   */
  function addArrow(step) {
    if (step.options.arrow && step.el) {
      return step.el.querySelector('.shepherd-arrow');
    }
    return false;
  }

  function noop() {}
  function assign(tar, src) {
    // @ts-ignore
    for (const k in src) tar[k] = src[k];
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
    return a != a ? b == b : a !== b || a && typeof a === 'object' || typeof a === 'function';
  }
  function is_empty(obj) {
    return Object.keys(obj).length === 0;
  }
  function append(target, node) {
    target.appendChild(node);
  }
  function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
  }
  function detach(node) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
  function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
      if (iterations[i]) iterations[i].d(detaching);
    }
  }
  function element(name) {
    return document.createElement(name);
  }
  function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    if (value == null) node.removeAttribute(attribute);else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
  }
  function set_attributes(node, attributes) {
    // @ts-ignore
    const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
    for (const key in attributes) {
      if (attributes[key] == null) {
        node.removeAttribute(key);
      } else if (key === 'style') {
        node.style.cssText = attributes[key];
      } else if (key === '__value') {
        node.value = node[key] = attributes[key];
      } else if (descriptors[key] && descriptors[key].set) {
        node[key] = attributes[key];
      } else {
        attr(node, key, attributes[key]);
      }
    }
  }
  function children(element) {
    return Array.from(element.childNodes);
  }
  function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
  }
  let current_component;
  function set_current_component(component) {
    current_component = component;
  }
  function get_current_component() {
    if (!current_component) throw new Error('Function called outside component initialization');
    return current_component;
  }
  /**
   * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
   * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
   * it can be called from an external module).
   *
   * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
   *
   * https://svelte.dev/docs#run-time-svelte-onmount
   */
  function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
  }
  /**
   * Schedules a callback to run immediately after the component has been updated.
   *
   * The first time the callback runs will be after the initial `onMount`
   */
  function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
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
  // flush() calls callbacks in this order:
  // 1. All beforeUpdate callbacks, in order: parents before children
  // 2. All bind:this callbacks, in reverse order: children before parents.
  // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
  //    for afterUpdates called during the initial onMount, which are called in
  //    reverse order: children before parents.
  // Since callbacks might update component values, which could trigger another
  // call to flush(), the following steps guard against this:
  // 1. During beforeUpdate, any updated components will be added to the
  //    dirty_components array and will cause a reentrant call to flush(). Because
  //    the flush index is kept outside the function, the reentrant call will pick
  //    up where the earlier call left off and go through all dirty components. The
  //    current_component value is saved and restored so that the reentrant call will
  //    not interfere with the "parent" flush() call.
  // 2. bind:this callbacks cannot trigger new flush() calls.
  // 3. During afterUpdate, any updated components will NOT have their afterUpdate
  //    callback called a second time; the seen_callbacks set, outside the flush()
  //    function, guarantees this behavior.
  const seen_callbacks = new Set();
  let flushidx = 0; // Do *not* move this inside the flush() function
  function flush() {
    const saved_component = current_component;
    do {
      // first, call beforeUpdate functions
      // and update components
      while (flushidx < dirty_components.length) {
        const component = dirty_components[flushidx];
        flushidx++;
        set_current_component(component);
        update(component.$$);
      }
      set_current_component(null);
      dirty_components.length = 0;
      flushidx = 0;
      while (binding_callbacks.length) binding_callbacks.pop()();
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
    seen_callbacks.clear();
    set_current_component(saved_component);
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
      if (outroing.has(block)) return;
      outroing.add(block);
      outros.c.push(() => {
        outroing.delete(block);
        if (callback) {
          if (detach) block.d(1);
          callback();
        }
      });
      block.o(local);
    } else if (callback) {
      callback();
    }
  }
  function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = {
      $$scope: 1
    };
    let i = levels.length;
    while (i--) {
      const o = levels[i];
      const n = updates[i];
      if (n) {
        for (const key in o) {
          if (!(key in n)) to_null_out[key] = 1;
        }
        for (const key in n) {
          if (!accounted_for[key]) {
            update[key] = n[key];
            accounted_for[key] = 1;
          }
        }
        levels[i] = n;
      } else {
        for (const key in o) {
          accounted_for[key] = 1;
        }
      }
    }
    for (const key in to_null_out) {
      if (!(key in update)) update[key] = undefined;
    }
    return update;
  }
  function create_component(block) {
    block && block.c();
  }
  function mount_component(component, target, anchor, customElement) {
    const {
      fragment,
      after_update
    } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
      // onMount happens before the initial afterUpdate
      add_render_callback(() => {
        const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
        // if the component was destroyed immediately
        // it will update the `$$.on_destroy` reference to `null`.
        // the destructured on_destroy may still reference to the old array
        if (component.$$.on_destroy) {
          component.$$.on_destroy.push(...new_on_destroy);
        } else {
          // Edge case - component was destroyed immediately,
          // most likely as a result of a binding initialising
          run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
      });
    }
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
    component.$$.dirty[i / 31 | 0] |= 1 << i % 31;
  }
  function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty) {
    if (dirty === void 0) {
      dirty = [-1];
    }
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
      fragment: null,
      ctx: [],
      // state
      props,
      update: noop,
      not_equal,
      bound: blank_object(),
      // lifecycle
      on_mount: [],
      on_destroy: [],
      on_disconnect: [],
      before_update: [],
      after_update: [],
      context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
      // everything else
      callbacks: blank_object(),
      dirty,
      skip_bound: false,
      root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance ? instance(component, options.props || {}, function (i, ret) {
      const value = (arguments.length <= 2 ? 0 : arguments.length - 2) ? arguments.length <= 2 ? undefined : arguments[2] : ret;
      if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
        if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
        if (ready) make_dirty(component, i);
      }
      return ret;
    }) : [];
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
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        $$.fragment && $$.fragment.c();
      }
      if (options.intro) transition_in(component.$$.fragment);
      mount_component(component, options.target, options.anchor, options.customElement);
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
      if (!is_function(callback)) {
        return noop;
      }
      const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
      callbacks.push(callback);
      return () => {
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
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

  /* src/js/components/shepherd-button.svelte generated by Svelte v3.54.0 */
  function create_fragment$8(ctx) {
    let button;
    let button_aria_label_value;
    let button_class_value;
    let mounted;
    let dispose;
    return {
      c() {
        button = element("button");
        attr(button, "aria-label", button_aria_label_value = /*label*/ctx[3] ? /*label*/ctx[3] : null);
        attr(button, "class", button_class_value = `${/*classes*/ctx[1] || ''} shepherd-button ${/*secondary*/ctx[4] ? 'shepherd-button-secondary' : ''}`);
        button.disabled = /*disabled*/ctx[2];
        attr(button, "tabindex", "0");
      },
      m(target, anchor) {
        insert(target, button, anchor);
        button.innerHTML = /*text*/ctx[5];
        if (!mounted) {
          dispose = listen(button, "click", function () {
            if (is_function( /*action*/ctx[0])) /*action*/ctx[0].apply(this, arguments);
          });
          mounted = true;
        }
      },
      p(new_ctx, _ref) {
        let [dirty] = _ref;
        ctx = new_ctx;
        if (dirty & /*text*/32) button.innerHTML = /*text*/ctx[5];
        if (dirty & /*label*/8 && button_aria_label_value !== (button_aria_label_value = /*label*/ctx[3] ? /*label*/ctx[3] : null)) {
          attr(button, "aria-label", button_aria_label_value);
        }
        if (dirty & /*classes, secondary*/18 && button_class_value !== (button_class_value = `${/*classes*/ctx[1] || ''} shepherd-button ${/*secondary*/ctx[4] ? 'shepherd-button-secondary' : ''}`)) {
          attr(button, "class", button_class_value);
        }
        if (dirty & /*disabled*/4) {
          button.disabled = /*disabled*/ctx[2];
        }
      },
      i: noop,
      o: noop,
      d(detaching) {
        if (detaching) detach(button);
        mounted = false;
        dispose();
      }
    };
  }
  function instance$8($$self, $$props, $$invalidate) {
    let {
      config,
      step
    } = $$props;
    let action, classes, disabled, label, secondary, text;
    function getConfigOption(option) {
      if (isFunction(option)) {
        return option = option.call(step);
      }
      return option;
    }
    $$self.$$set = $$props => {
      if ('config' in $$props) $$invalidate(6, config = $$props.config);
      if ('step' in $$props) $$invalidate(7, step = $$props.step);
    };
    $$self.$$.update = () => {
      if ($$self.$$.dirty & /*config, step*/192) {
        {
          $$invalidate(0, action = config.action ? config.action.bind(step.tour) : null);
          $$invalidate(1, classes = config.classes);
          $$invalidate(2, disabled = config.disabled ? getConfigOption(config.disabled) : false);
          $$invalidate(3, label = config.label ? getConfigOption(config.label) : null);
          $$invalidate(4, secondary = config.secondary);
          $$invalidate(5, text = config.text ? getConfigOption(config.text) : null);
        }
      }
    };
    return [action, classes, disabled, label, secondary, text, config, step];
  }
  class Shepherd_button extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$8, create_fragment$8, safe_not_equal, {
        config: 6,
        step: 7
      });
    }
  }

  /* src/js/components/shepherd-footer.svelte generated by Svelte v3.54.0 */
  function get_each_context(ctx, list, i) {
    const child_ctx = ctx.slice();
    child_ctx[2] = list[i];
    return child_ctx;
  }

  // (24:4) {#if buttons}
  function create_if_block$3(ctx) {
    let each_1_anchor;
    let current;
    let each_value = /*buttons*/ctx[1];
    let each_blocks = [];
    for (let i = 0; i < each_value.length; i += 1) {
      each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    }
    const out = i => transition_out(each_blocks[i], 1, 1, () => {
      each_blocks[i] = null;
    });
    return {
      c() {
        for (let i = 0; i < each_blocks.length; i += 1) {
          each_blocks[i].c();
        }
        each_1_anchor = empty();
      },
      m(target, anchor) {
        for (let i = 0; i < each_blocks.length; i += 1) {
          each_blocks[i].m(target, anchor);
        }
        insert(target, each_1_anchor, anchor);
        current = true;
      },
      p(ctx, dirty) {
        if (dirty & /*buttons, step*/3) {
          each_value = /*buttons*/ctx[1];
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
      }
    };
  }

  // (25:8) {#each buttons as config}
  function create_each_block(ctx) {
    let shepherdbutton;
    let current;
    shepherdbutton = new Shepherd_button({
      props: {
        config: /*config*/ctx[2],
        step: /*step*/ctx[0]
      }
    });
    return {
      c() {
        create_component(shepherdbutton.$$.fragment);
      },
      m(target, anchor) {
        mount_component(shepherdbutton, target, anchor);
        current = true;
      },
      p(ctx, dirty) {
        const shepherdbutton_changes = {};
        if (dirty & /*buttons*/2) shepherdbutton_changes.config = /*config*/ctx[2];
        if (dirty & /*step*/1) shepherdbutton_changes.step = /*step*/ctx[0];
        shepherdbutton.$set(shepherdbutton_changes);
      },
      i(local) {
        if (current) return;
        transition_in(shepherdbutton.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(shepherdbutton.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        destroy_component(shepherdbutton, detaching);
      }
    };
  }
  function create_fragment$7(ctx) {
    let footer;
    let current;
    let if_block = /*buttons*/ctx[1] && create_if_block$3(ctx);
    return {
      c() {
        footer = element("footer");
        if (if_block) if_block.c();
        attr(footer, "class", "shepherd-footer");
      },
      m(target, anchor) {
        insert(target, footer, anchor);
        if (if_block) if_block.m(footer, null);
        current = true;
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if ( /*buttons*/ctx[1]) {
          if (if_block) {
            if_block.p(ctx, dirty);
            if (dirty & /*buttons*/2) {
              transition_in(if_block, 1);
            }
          } else {
            if_block = create_if_block$3(ctx);
            if_block.c();
            transition_in(if_block, 1);
            if_block.m(footer, null);
          }
        } else if (if_block) {
          group_outros();
          transition_out(if_block, 1, 1, () => {
            if_block = null;
          });
          check_outros();
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
        if (detaching) detach(footer);
        if (if_block) if_block.d();
      }
    };
  }
  function instance$7($$self, $$props, $$invalidate) {
    let buttons;
    let {
      step
    } = $$props;
    $$self.$$set = $$props => {
      if ('step' in $$props) $$invalidate(0, step = $$props.step);
    };
    $$self.$$.update = () => {
      if ($$self.$$.dirty & /*step*/1) {
        $$invalidate(1, buttons = step.options.buttons);
      }
    };
    return [step, buttons];
  }
  class Shepherd_footer extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$7, create_fragment$7, safe_not_equal, {
        step: 0
      });
    }
  }

  /* src/js/components/shepherd-cancel-icon.svelte generated by Svelte v3.54.0 */
  function create_fragment$6(ctx) {
    let button;
    let span;
    let button_aria_label_value;
    let mounted;
    let dispose;
    return {
      c() {
        button = element("button");
        span = element("span");
        span.textContent = "×";
        attr(span, "aria-hidden", "true");
        attr(button, "aria-label", button_aria_label_value = /*cancelIcon*/ctx[0].label ? /*cancelIcon*/ctx[0].label : 'Close Tour');
        attr(button, "class", "shepherd-cancel-icon");
        attr(button, "type", "button");
      },
      m(target, anchor) {
        insert(target, button, anchor);
        append(button, span);
        if (!mounted) {
          dispose = listen(button, "click", /*handleCancelClick*/ctx[1]);
          mounted = true;
        }
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if (dirty & /*cancelIcon*/1 && button_aria_label_value !== (button_aria_label_value = /*cancelIcon*/ctx[0].label ? /*cancelIcon*/ctx[0].label : 'Close Tour')) {
          attr(button, "aria-label", button_aria_label_value);
        }
      },
      i: noop,
      o: noop,
      d(detaching) {
        if (detaching) detach(button);
        mounted = false;
        dispose();
      }
    };
  }
  function instance$6($$self, $$props, $$invalidate) {
    let {
      cancelIcon,
      step
    } = $$props;

    /**
    * Add a click listener to the cancel link that cancels the tour
    */
    const handleCancelClick = e => {
      e.preventDefault();
      step.cancel();
    };
    $$self.$$set = $$props => {
      if ('cancelIcon' in $$props) $$invalidate(0, cancelIcon = $$props.cancelIcon);
      if ('step' in $$props) $$invalidate(2, step = $$props.step);
    };
    return [cancelIcon, handleCancelClick, step];
  }
  class Shepherd_cancel_icon extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$6, create_fragment$6, safe_not_equal, {
        cancelIcon: 0,
        step: 2
      });
    }
  }

  /* src/js/components/shepherd-title.svelte generated by Svelte v3.54.0 */
  function create_fragment$5(ctx) {
    let h3;
    return {
      c() {
        h3 = element("h3");
        attr(h3, "id", /*labelId*/ctx[1]);
        attr(h3, "class", "shepherd-title");
      },
      m(target, anchor) {
        insert(target, h3, anchor);
        /*h3_binding*/
        ctx[3](h3);
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if (dirty & /*labelId*/2) {
          attr(h3, "id", /*labelId*/ctx[1]);
        }
      },
      i: noop,
      o: noop,
      d(detaching) {
        if (detaching) detach(h3);
        /*h3_binding*/
        ctx[3](null);
      }
    };
  }
  function instance$5($$self, $$props, $$invalidate) {
    let {
      labelId,
      element,
      title
    } = $$props;
    afterUpdate(() => {
      if (isFunction(title)) {
        $$invalidate(2, title = title());
      }
      $$invalidate(0, element.innerHTML = title, element);
    });
    function h3_binding($$value) {
      binding_callbacks[$$value ? 'unshift' : 'push'](() => {
        element = $$value;
        $$invalidate(0, element);
      });
    }
    $$self.$$set = $$props => {
      if ('labelId' in $$props) $$invalidate(1, labelId = $$props.labelId);
      if ('element' in $$props) $$invalidate(0, element = $$props.element);
      if ('title' in $$props) $$invalidate(2, title = $$props.title);
    };
    return [element, labelId, title, h3_binding];
  }
  class Shepherd_title extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$5, create_fragment$5, safe_not_equal, {
        labelId: 1,
        element: 0,
        title: 2
      });
    }
  }

  /* src/js/components/shepherd-header.svelte generated by Svelte v3.54.0 */
  function create_if_block_1$1(ctx) {
    let shepherdtitle;
    let current;
    shepherdtitle = new Shepherd_title({
      props: {
        labelId: /*labelId*/ctx[0],
        title: /*title*/ctx[2]
      }
    });
    return {
      c() {
        create_component(shepherdtitle.$$.fragment);
      },
      m(target, anchor) {
        mount_component(shepherdtitle, target, anchor);
        current = true;
      },
      p(ctx, dirty) {
        const shepherdtitle_changes = {};
        if (dirty & /*labelId*/1) shepherdtitle_changes.labelId = /*labelId*/ctx[0];
        if (dirty & /*title*/4) shepherdtitle_changes.title = /*title*/ctx[2];
        shepherdtitle.$set(shepherdtitle_changes);
      },
      i(local) {
        if (current) return;
        transition_in(shepherdtitle.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(shepherdtitle.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        destroy_component(shepherdtitle, detaching);
      }
    };
  }

  // (39:4) {#if cancelIcon && cancelIcon.enabled}
  function create_if_block$2(ctx) {
    let shepherdcancelicon;
    let current;
    shepherdcancelicon = new Shepherd_cancel_icon({
      props: {
        cancelIcon: /*cancelIcon*/ctx[3],
        step: /*step*/ctx[1]
      }
    });
    return {
      c() {
        create_component(shepherdcancelicon.$$.fragment);
      },
      m(target, anchor) {
        mount_component(shepherdcancelicon, target, anchor);
        current = true;
      },
      p(ctx, dirty) {
        const shepherdcancelicon_changes = {};
        if (dirty & /*cancelIcon*/8) shepherdcancelicon_changes.cancelIcon = /*cancelIcon*/ctx[3];
        if (dirty & /*step*/2) shepherdcancelicon_changes.step = /*step*/ctx[1];
        shepherdcancelicon.$set(shepherdcancelicon_changes);
      },
      i(local) {
        if (current) return;
        transition_in(shepherdcancelicon.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(shepherdcancelicon.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        destroy_component(shepherdcancelicon, detaching);
      }
    };
  }
  function create_fragment$4(ctx) {
    let header;
    let t;
    let current;
    let if_block0 = /*title*/ctx[2] && create_if_block_1$1(ctx);
    let if_block1 = /*cancelIcon*/ctx[3] && /*cancelIcon*/ctx[3].enabled && create_if_block$2(ctx);
    return {
      c() {
        header = element("header");
        if (if_block0) if_block0.c();
        t = space();
        if (if_block1) if_block1.c();
        attr(header, "class", "shepherd-header");
      },
      m(target, anchor) {
        insert(target, header, anchor);
        if (if_block0) if_block0.m(header, null);
        append(header, t);
        if (if_block1) if_block1.m(header, null);
        current = true;
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if ( /*title*/ctx[2]) {
          if (if_block0) {
            if_block0.p(ctx, dirty);
            if (dirty & /*title*/4) {
              transition_in(if_block0, 1);
            }
          } else {
            if_block0 = create_if_block_1$1(ctx);
            if_block0.c();
            transition_in(if_block0, 1);
            if_block0.m(header, t);
          }
        } else if (if_block0) {
          group_outros();
          transition_out(if_block0, 1, 1, () => {
            if_block0 = null;
          });
          check_outros();
        }
        if ( /*cancelIcon*/ctx[3] && /*cancelIcon*/ctx[3].enabled) {
          if (if_block1) {
            if_block1.p(ctx, dirty);
            if (dirty & /*cancelIcon*/8) {
              transition_in(if_block1, 1);
            }
          } else {
            if_block1 = create_if_block$2(ctx);
            if_block1.c();
            transition_in(if_block1, 1);
            if_block1.m(header, null);
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
        transition_in(if_block0);
        transition_in(if_block1);
        current = true;
      },
      o(local) {
        transition_out(if_block0);
        transition_out(if_block1);
        current = false;
      },
      d(detaching) {
        if (detaching) detach(header);
        if (if_block0) if_block0.d();
        if (if_block1) if_block1.d();
      }
    };
  }
  function instance$4($$self, $$props, $$invalidate) {
    let {
      labelId,
      step
    } = $$props;
    let title, cancelIcon;
    $$self.$$set = $$props => {
      if ('labelId' in $$props) $$invalidate(0, labelId = $$props.labelId);
      if ('step' in $$props) $$invalidate(1, step = $$props.step);
    };
    $$self.$$.update = () => {
      if ($$self.$$.dirty & /*step*/2) {
        {
          $$invalidate(2, title = step.options.title);
          $$invalidate(3, cancelIcon = step.options.cancelIcon);
        }
      }
    };
    return [labelId, step, title, cancelIcon];
  }
  class Shepherd_header extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$4, create_fragment$4, safe_not_equal, {
        labelId: 0,
        step: 1
      });
    }
  }

  /* src/js/components/shepherd-text.svelte generated by Svelte v3.54.0 */
  function create_fragment$3(ctx) {
    let div;
    return {
      c() {
        div = element("div");
        attr(div, "class", "shepherd-text");
        attr(div, "id", /*descriptionId*/ctx[1]);
      },
      m(target, anchor) {
        insert(target, div, anchor);
        /*div_binding*/
        ctx[3](div);
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if (dirty & /*descriptionId*/2) {
          attr(div, "id", /*descriptionId*/ctx[1]);
        }
      },
      i: noop,
      o: noop,
      d(detaching) {
        if (detaching) detach(div);
        /*div_binding*/
        ctx[3](null);
      }
    };
  }
  function instance$3($$self, $$props, $$invalidate) {
    let {
      descriptionId,
      element,
      step
    } = $$props;
    afterUpdate(() => {
      let {
        text
      } = step.options;
      if (isFunction(text)) {
        text = text.call(step);
      }
      if (isHTMLElement$1(text)) {
        element.appendChild(text);
      } else {
        $$invalidate(0, element.innerHTML = text, element);
      }
    });
    function div_binding($$value) {
      binding_callbacks[$$value ? 'unshift' : 'push'](() => {
        element = $$value;
        $$invalidate(0, element);
      });
    }
    $$self.$$set = $$props => {
      if ('descriptionId' in $$props) $$invalidate(1, descriptionId = $$props.descriptionId);
      if ('element' in $$props) $$invalidate(0, element = $$props.element);
      if ('step' in $$props) $$invalidate(2, step = $$props.step);
    };
    return [element, descriptionId, step, div_binding];
  }
  class Shepherd_text extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$3, create_fragment$3, safe_not_equal, {
        descriptionId: 1,
        element: 0,
        step: 2
      });
    }
  }

  /* src/js/components/shepherd-content.svelte generated by Svelte v3.54.0 */
  function create_if_block_2(ctx) {
    let shepherdheader;
    let current;
    shepherdheader = new Shepherd_header({
      props: {
        labelId: /*labelId*/ctx[1],
        step: /*step*/ctx[2]
      }
    });
    return {
      c() {
        create_component(shepherdheader.$$.fragment);
      },
      m(target, anchor) {
        mount_component(shepherdheader, target, anchor);
        current = true;
      },
      p(ctx, dirty) {
        const shepherdheader_changes = {};
        if (dirty & /*labelId*/2) shepherdheader_changes.labelId = /*labelId*/ctx[1];
        if (dirty & /*step*/4) shepherdheader_changes.step = /*step*/ctx[2];
        shepherdheader.$set(shepherdheader_changes);
      },
      i(local) {
        if (current) return;
        transition_in(shepherdheader.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(shepherdheader.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        destroy_component(shepherdheader, detaching);
      }
    };
  }

  // (28:2) {#if !isUndefined(step.options.text)}
  function create_if_block_1(ctx) {
    let shepherdtext;
    let current;
    shepherdtext = new Shepherd_text({
      props: {
        descriptionId: /*descriptionId*/ctx[0],
        step: /*step*/ctx[2]
      }
    });
    return {
      c() {
        create_component(shepherdtext.$$.fragment);
      },
      m(target, anchor) {
        mount_component(shepherdtext, target, anchor);
        current = true;
      },
      p(ctx, dirty) {
        const shepherdtext_changes = {};
        if (dirty & /*descriptionId*/1) shepherdtext_changes.descriptionId = /*descriptionId*/ctx[0];
        if (dirty & /*step*/4) shepherdtext_changes.step = /*step*/ctx[2];
        shepherdtext.$set(shepherdtext_changes);
      },
      i(local) {
        if (current) return;
        transition_in(shepherdtext.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(shepherdtext.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        destroy_component(shepherdtext, detaching);
      }
    };
  }

  // (35:2) {#if Array.isArray(step.options.buttons) && step.options.buttons.length}
  function create_if_block$1(ctx) {
    let shepherdfooter;
    let current;
    shepherdfooter = new Shepherd_footer({
      props: {
        step: /*step*/ctx[2]
      }
    });
    return {
      c() {
        create_component(shepherdfooter.$$.fragment);
      },
      m(target, anchor) {
        mount_component(shepherdfooter, target, anchor);
        current = true;
      },
      p(ctx, dirty) {
        const shepherdfooter_changes = {};
        if (dirty & /*step*/4) shepherdfooter_changes.step = /*step*/ctx[2];
        shepherdfooter.$set(shepherdfooter_changes);
      },
      i(local) {
        if (current) return;
        transition_in(shepherdfooter.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(shepherdfooter.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        destroy_component(shepherdfooter, detaching);
      }
    };
  }
  function create_fragment$2(ctx) {
    let div;
    let show_if_2 = !isUndefined( /*step*/ctx[2].options.title) || /*step*/ctx[2].options.cancelIcon && /*step*/ctx[2].options.cancelIcon.enabled;
    let t0;
    let show_if_1 = !isUndefined( /*step*/ctx[2].options.text);
    let t1;
    let show_if = Array.isArray( /*step*/ctx[2].options.buttons) && /*step*/ctx[2].options.buttons.length;
    let current;
    let if_block0 = show_if_2 && create_if_block_2(ctx);
    let if_block1 = show_if_1 && create_if_block_1(ctx);
    let if_block2 = show_if && create_if_block$1(ctx);
    return {
      c() {
        div = element("div");
        if (if_block0) if_block0.c();
        t0 = space();
        if (if_block1) if_block1.c();
        t1 = space();
        if (if_block2) if_block2.c();
        attr(div, "class", "shepherd-content");
      },
      m(target, anchor) {
        insert(target, div, anchor);
        if (if_block0) if_block0.m(div, null);
        append(div, t0);
        if (if_block1) if_block1.m(div, null);
        append(div, t1);
        if (if_block2) if_block2.m(div, null);
        current = true;
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if (dirty & /*step*/4) show_if_2 = !isUndefined( /*step*/ctx[2].options.title) || /*step*/ctx[2].options.cancelIcon && /*step*/ctx[2].options.cancelIcon.enabled;
        if (show_if_2) {
          if (if_block0) {
            if_block0.p(ctx, dirty);
            if (dirty & /*step*/4) {
              transition_in(if_block0, 1);
            }
          } else {
            if_block0 = create_if_block_2(ctx);
            if_block0.c();
            transition_in(if_block0, 1);
            if_block0.m(div, t0);
          }
        } else if (if_block0) {
          group_outros();
          transition_out(if_block0, 1, 1, () => {
            if_block0 = null;
          });
          check_outros();
        }
        if (dirty & /*step*/4) show_if_1 = !isUndefined( /*step*/ctx[2].options.text);
        if (show_if_1) {
          if (if_block1) {
            if_block1.p(ctx, dirty);
            if (dirty & /*step*/4) {
              transition_in(if_block1, 1);
            }
          } else {
            if_block1 = create_if_block_1(ctx);
            if_block1.c();
            transition_in(if_block1, 1);
            if_block1.m(div, t1);
          }
        } else if (if_block1) {
          group_outros();
          transition_out(if_block1, 1, 1, () => {
            if_block1 = null;
          });
          check_outros();
        }
        if (dirty & /*step*/4) show_if = Array.isArray( /*step*/ctx[2].options.buttons) && /*step*/ctx[2].options.buttons.length;
        if (show_if) {
          if (if_block2) {
            if_block2.p(ctx, dirty);
            if (dirty & /*step*/4) {
              transition_in(if_block2, 1);
            }
          } else {
            if_block2 = create_if_block$1(ctx);
            if_block2.c();
            transition_in(if_block2, 1);
            if_block2.m(div, null);
          }
        } else if (if_block2) {
          group_outros();
          transition_out(if_block2, 1, 1, () => {
            if_block2 = null;
          });
          check_outros();
        }
      },
      i(local) {
        if (current) return;
        transition_in(if_block0);
        transition_in(if_block1);
        transition_in(if_block2);
        current = true;
      },
      o(local) {
        transition_out(if_block0);
        transition_out(if_block1);
        transition_out(if_block2);
        current = false;
      },
      d(detaching) {
        if (detaching) detach(div);
        if (if_block0) if_block0.d();
        if (if_block1) if_block1.d();
        if (if_block2) if_block2.d();
      }
    };
  }
  function instance$2($$self, $$props, $$invalidate) {
    let {
      descriptionId,
      labelId,
      step
    } = $$props;
    $$self.$$set = $$props => {
      if ('descriptionId' in $$props) $$invalidate(0, descriptionId = $$props.descriptionId);
      if ('labelId' in $$props) $$invalidate(1, labelId = $$props.labelId);
      if ('step' in $$props) $$invalidate(2, step = $$props.step);
    };
    return [descriptionId, labelId, step];
  }
  class Shepherd_content extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$2, create_fragment$2, safe_not_equal, {
        descriptionId: 0,
        labelId: 1,
        step: 2
      });
    }
  }

  /* src/js/components/shepherd-element.svelte generated by Svelte v3.54.0 */
  function create_if_block(ctx) {
    let div;
    return {
      c() {
        div = element("div");
        attr(div, "class", "shepherd-arrow");
        attr(div, "data-popper-arrow", "");
      },
      m(target, anchor) {
        insert(target, div, anchor);
      },
      d(detaching) {
        if (detaching) detach(div);
      }
    };
  }
  function create_fragment$1(ctx) {
    let div;
    let t;
    let shepherdcontent;
    let div_aria_describedby_value;
    let div_aria_labelledby_value;
    let current;
    let mounted;
    let dispose;
    let if_block = /*step*/ctx[4].options.arrow && /*step*/ctx[4].options.attachTo && /*step*/ctx[4].options.attachTo.element && /*step*/ctx[4].options.attachTo.on && create_if_block();
    shepherdcontent = new Shepherd_content({
      props: {
        descriptionId: /*descriptionId*/ctx[2],
        labelId: /*labelId*/ctx[3],
        step: /*step*/ctx[4]
      }
    });
    let div_levels = [{
      "aria-describedby": div_aria_describedby_value = !isUndefined( /*step*/ctx[4].options.text) ? /*descriptionId*/ctx[2] : null
    }, {
      "aria-labelledby": div_aria_labelledby_value = /*step*/ctx[4].options.title ? /*labelId*/ctx[3] : null
    }, /*dataStepId*/ctx[1], {
      role: "dialog"
    }, {
      tabindex: "0"
    }];
    let div_data = {};
    for (let i = 0; i < div_levels.length; i += 1) {
      div_data = assign(div_data, div_levels[i]);
    }
    return {
      c() {
        div = element("div");
        if (if_block) if_block.c();
        t = space();
        create_component(shepherdcontent.$$.fragment);
        set_attributes(div, div_data);
        toggle_class(div, "shepherd-has-cancel-icon", /*hasCancelIcon*/ctx[5]);
        toggle_class(div, "shepherd-has-title", /*hasTitle*/ctx[6]);
        toggle_class(div, "shepherd-element", true);
      },
      m(target, anchor) {
        insert(target, div, anchor);
        if (if_block) if_block.m(div, null);
        append(div, t);
        mount_component(shepherdcontent, div, null);
        /*div_binding*/
        ctx[13](div);
        current = true;
        if (!mounted) {
          dispose = listen(div, "keydown", /*handleKeyDown*/ctx[7]);
          mounted = true;
        }
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if ( /*step*/ctx[4].options.arrow && /*step*/ctx[4].options.attachTo && /*step*/ctx[4].options.attachTo.element && /*step*/ctx[4].options.attachTo.on) {
          if (if_block) ; else {
            if_block = create_if_block();
            if_block.c();
            if_block.m(div, t);
          }
        } else if (if_block) {
          if_block.d(1);
          if_block = null;
        }
        const shepherdcontent_changes = {};
        if (dirty & /*descriptionId*/4) shepherdcontent_changes.descriptionId = /*descriptionId*/ctx[2];
        if (dirty & /*labelId*/8) shepherdcontent_changes.labelId = /*labelId*/ctx[3];
        if (dirty & /*step*/16) shepherdcontent_changes.step = /*step*/ctx[4];
        shepherdcontent.$set(shepherdcontent_changes);
        set_attributes(div, div_data = get_spread_update(div_levels, [(!current || dirty & /*step, descriptionId*/20 && div_aria_describedby_value !== (div_aria_describedby_value = !isUndefined( /*step*/ctx[4].options.text) ? /*descriptionId*/ctx[2] : null)) && {
          "aria-describedby": div_aria_describedby_value
        }, (!current || dirty & /*step, labelId*/24 && div_aria_labelledby_value !== (div_aria_labelledby_value = /*step*/ctx[4].options.title ? /*labelId*/ctx[3] : null)) && {
          "aria-labelledby": div_aria_labelledby_value
        }, dirty & /*dataStepId*/2 && /*dataStepId*/ctx[1], {
          role: "dialog"
        }, {
          tabindex: "0"
        }]));
        toggle_class(div, "shepherd-has-cancel-icon", /*hasCancelIcon*/ctx[5]);
        toggle_class(div, "shepherd-has-title", /*hasTitle*/ctx[6]);
        toggle_class(div, "shepherd-element", true);
      },
      i(local) {
        if (current) return;
        transition_in(shepherdcontent.$$.fragment, local);
        current = true;
      },
      o(local) {
        transition_out(shepherdcontent.$$.fragment, local);
        current = false;
      },
      d(detaching) {
        if (detaching) detach(div);
        if (if_block) if_block.d();
        destroy_component(shepherdcontent);
        /*div_binding*/
        ctx[13](null);
        mounted = false;
        dispose();
      }
    };
  }
  const KEY_TAB = 9;
  const KEY_ESC = 27;
  const LEFT_ARROW = 37;
  const RIGHT_ARROW = 39;
  function getClassesArray(classes) {
    return classes.split(' ').filter(className => !!className.length);
  }
  function instance$1($$self, $$props, $$invalidate) {
    let {
      classPrefix,
      element,
      descriptionId,
      firstFocusableElement,
      focusableElements,
      labelId,
      lastFocusableElement,
      step,
      dataStepId
    } = $$props;
    let hasCancelIcon, hasTitle, classes;
    const getElement = () => element;
    onMount(() => {
      // Get all elements that are focusable
      $$invalidate(1, dataStepId = {
        [`data-${classPrefix}shepherd-step-id`]: step.id
      });
      $$invalidate(9, focusableElements = element.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'));
      $$invalidate(8, firstFocusableElement = focusableElements[0]);
      $$invalidate(10, lastFocusableElement = focusableElements[focusableElements.length - 1]);
    });
    afterUpdate(() => {
      if (classes !== step.options.classes) {
        updateDynamicClasses();
      }
    });
    function updateDynamicClasses() {
      removeClasses(classes);
      classes = step.options.classes;
      addClasses(classes);
    }
    function removeClasses(classes) {
      if (isString(classes)) {
        const oldClasses = getClassesArray(classes);
        if (oldClasses.length) {
          element.classList.remove(...oldClasses);
        }
      }
    }
    function addClasses(classes) {
      if (isString(classes)) {
        const newClasses = getClassesArray(classes);
        if (newClasses.length) {
          element.classList.add(...newClasses);
        }
      }
    }

    /**
    * Setup keydown events to allow closing the modal with ESC
    *
    * Borrowed from this great post! https://bitsofco.de/accessible-modal-dialog/
    *
    * @private
    */
    const handleKeyDown = e => {
      const {
        tour
      } = step;
      switch (e.keyCode) {
        case KEY_TAB:
          if (focusableElements.length === 0) {
            e.preventDefault();
            break;
          }
          // Backward tab
          if (e.shiftKey) {
            if (document.activeElement === firstFocusableElement || document.activeElement.classList.contains('shepherd-element')) {
              e.preventDefault();
              lastFocusableElement.focus();
            }
          } else {
            if (document.activeElement === lastFocusableElement) {
              e.preventDefault();
              firstFocusableElement.focus();
            }
          }
          break;
        case KEY_ESC:
          if (tour.options.exitOnEsc) {
            step.cancel();
          }
          break;
        case LEFT_ARROW:
          if (tour.options.keyboardNavigation) {
            tour.back();
          }
          break;
        case RIGHT_ARROW:
          if (tour.options.keyboardNavigation) {
            tour.next();
          }
          break;
      }
    };
    function div_binding($$value) {
      binding_callbacks[$$value ? 'unshift' : 'push'](() => {
        element = $$value;
        $$invalidate(0, element);
      });
    }
    $$self.$$set = $$props => {
      if ('classPrefix' in $$props) $$invalidate(11, classPrefix = $$props.classPrefix);
      if ('element' in $$props) $$invalidate(0, element = $$props.element);
      if ('descriptionId' in $$props) $$invalidate(2, descriptionId = $$props.descriptionId);
      if ('firstFocusableElement' in $$props) $$invalidate(8, firstFocusableElement = $$props.firstFocusableElement);
      if ('focusableElements' in $$props) $$invalidate(9, focusableElements = $$props.focusableElements);
      if ('labelId' in $$props) $$invalidate(3, labelId = $$props.labelId);
      if ('lastFocusableElement' in $$props) $$invalidate(10, lastFocusableElement = $$props.lastFocusableElement);
      if ('step' in $$props) $$invalidate(4, step = $$props.step);
      if ('dataStepId' in $$props) $$invalidate(1, dataStepId = $$props.dataStepId);
    };
    $$self.$$.update = () => {
      if ($$self.$$.dirty & /*step*/16) {
        {
          $$invalidate(5, hasCancelIcon = step.options && step.options.cancelIcon && step.options.cancelIcon.enabled);
          $$invalidate(6, hasTitle = step.options && step.options.title);
        }
      }
    };
    return [element, dataStepId, descriptionId, labelId, step, hasCancelIcon, hasTitle, handleKeyDown, firstFocusableElement, focusableElements, lastFocusableElement, classPrefix, getElement, div_binding];
  }
  class Shepherd_element extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance$1, create_fragment$1, safe_not_equal, {
        classPrefix: 11,
        element: 0,
        descriptionId: 2,
        firstFocusableElement: 8,
        focusableElements: 9,
        labelId: 3,
        lastFocusableElement: 10,
        step: 4,
        dataStepId: 1,
        getElement: 12
      });
    }
    get getElement() {
      return this.$$.ctx[12];
    }
  }

  /**
   * A class representing steps to be added to a tour.
   * @extends {Evented}
   */
  class Step extends Evented {
    /**
     * Create a step
     * @param {Tour} tour The tour for the step
     * @param {object} options The options for the step
     * @param {boolean} options.arrow Whether to display the arrow for the tooltip or not. Defaults to `true`.
     * @param {object} options.attachTo The element the step should be attached to on the page.
     * An object with properties `element` and `on`.
     *
     * ```js
     * const step = new Step(tour, {
     *   attachTo: { element: '.some .selector-path', on: 'left' },
     *   ...moreOptions
     * });
     * ```
     *
     * If you don’t specify an `attachTo` the element will appear in the middle of the screen. The same will happen if your `attachTo.element` callback returns `null`, `undefined`, or a selector that does not exist in the DOM.
     * If you omit the `on` portion of `attachTo`, the element will still be highlighted, but the tooltip will appear
     * in the middle of the screen, without an arrow pointing to the target.
     * If the element to highlight does not yet exist while instantiating tour steps, you may use lazy evaluation by supplying a function to `attachTo.element`. The function will be called in the `before-show` phase.
     * @param {string|HTMLElement|function} options.attachTo.element An element selector string, DOM element, or a function (returning a selector, a DOM element, `null` or `undefined`).
     * @param {string} options.attachTo.on The optional direction to place the FloatingUI tooltip relative to the element.
     *   - Possible string values: 'top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'right', 'right-start', 'right-end', 'left', 'left-start', 'left-end'
     * @param {Object} options.advanceOn An action on the page which should advance shepherd to the next step.
     * It should be an object with a string `selector` and an `event` name
     * ```js
     * const step = new Step(tour, {
     *   advanceOn: { selector: '.some .selector-path', event: 'click' },
     *   ...moreOptions
     * });
     * ```
     * `event` doesn’t have to be an event inside the tour, it can be any event fired on any element on the page.
     * You can also always manually advance the Tour by calling `myTour.next()`.
     * @param {function} options.beforeShowPromise A function that returns a promise.
     * When the promise resolves, the rest of the `show` code for the step will execute.
     * @param {Object[]} options.buttons An array of buttons to add to the step. These will be rendered in a
     * footer below the main body text.
     * @param {function} options.buttons.button.action A function executed when the button is clicked on.
     * It is automatically bound to the `tour` the step is associated with, so things like `this.next` will
     * work inside the action.
     * You can use action to skip steps or navigate to specific steps, with something like:
     * ```js
     * action() {
     *   return this.show('some_step_name');
     * }
     * ```
     * @param {string} options.buttons.button.classes Extra classes to apply to the `<a>`
     * @param {boolean} options.buttons.button.disabled Should the button be disabled?
     * @param {string} options.buttons.button.label The aria-label text of the button
     * @param {boolean} options.buttons.button.secondary If true, a shepherd-button-secondary class is applied to the button
     * @param {string} options.buttons.button.text The HTML text of the button
     * @param {boolean} options.canClickTarget A boolean, that when set to false, will set `pointer-events: none` on the target
     * @param {object} options.cancelIcon Options for the cancel icon
     * @param {boolean} options.cancelIcon.enabled Should a cancel “✕” be shown in the header of the step?
     * @param {string} options.cancelIcon.label The label to add for `aria-label`
     * @param {string} options.classes A string of extra classes to add to the step's content element.
     * @param {string} options.highlightClass An extra class to apply to the `attachTo` element when it is
     * highlighted (that is, when its step is active). You can then target that selector in your CSS.
     * @param {string} options.id The string to use as the `id` for the step.
     * @param {number} options.modalOverlayOpeningPadding An amount of padding to add around the modal overlay opening
     * @param {number | { topLeft: number, bottomLeft: number, bottomRight: number, topRight: number }} options.modalOverlayOpeningRadius An amount of border radius to add around the modal overlay opening
     * @param {object} options.floatingUIOptions Extra options to pass to FloatingUI
     * @param {boolean|Object} options.scrollTo Should the element be scrolled to when this step is shown? If true, uses the default `scrollIntoView`,
     * if an object, passes that object as the params to `scrollIntoView` i.e. `{behavior: 'smooth', block: 'center'}`
     * @param {function} options.scrollToHandler A function that lets you override the default scrollTo behavior and
     * define a custom action to do the scrolling, and possibly other logic.
     * @param {function} options.showOn A function that, when it returns `true`, will show the step.
     * If it returns false, the step will be skipped.
     * @param {string} options.text The text in the body of the step. It can be one of three types:
     * ```
     * - HTML string
     * - `HTMLElement` object
     * - `Function` to be executed when the step is built. It must return one the two options above.
     * ```
     * @param {string} options.title The step's title. It becomes an `h3` at the top of the step. It can be one of two types:
     * ```
     * - HTML string
     * - `Function` to be executed when the step is built. It must return HTML string.
     * ```
     * @param {object} options.when You can define `show`, `hide`, etc events inside `when`. For example:
     * ```js
     * when: {
     *   show: function() {
     *     window.scrollTo(0, 0);
     *   }
     * }
     * ```
     * @return {Step} The newly created Step instance
     */
    constructor(tour, options) {
      if (options === void 0) {
        options = {};
      }
      super(tour, options);
      this.tour = tour;
      this.classPrefix = this.tour.options ? normalizePrefix(this.tour.options.classPrefix) : '';
      this.styles = tour.styles;

      /**
       * Resolved attachTo options. Due to lazy evaluation, we only resolve the options during `before-show` phase.
       * Do not use this directly, use the _getResolvedAttachToOptions method instead.
       * @type {null|{}|{element, to}}
       * @private
       */
      this._resolvedAttachTo = null;
      autoBind(this);
      this._setOptions(options);
      return this;
    }

    /**
     * Cancel the tour
     * Triggers the `cancel` event
     */
    cancel() {
      this.tour.cancel();
      this.trigger('cancel');
    }

    /**
     * Complete the tour
     * Triggers the `complete` event
     */
    complete() {
      this.tour.complete();
      this.trigger('complete');
    }

    /**
     * Remove the step, delete the step's element, and destroy the FloatingUI instance for the step.
     * Triggers `destroy` event
     */
    destroy() {
      destroyTooltip(this);
      if (isHTMLElement$1(this.el)) {
        this.el.remove();
        this.el = null;
      }
      this._updateStepTargetOnHide();
      this.trigger('destroy');
    }

    /**
     * Returns the tour for the step
     * @return {Tour} The tour instance
     */
    getTour() {
      return this.tour;
    }

    /**
     * Hide the step
     */
    hide() {
      this.tour.modal.hide();
      this.trigger('before-hide');
      if (this.el) {
        this.el.hidden = true;
      }
      this._updateStepTargetOnHide();
      this.trigger('hide');
    }

    /**
     * Resolves attachTo options.
     * @returns {{}|{element, on}}
     * @private
     */
    _resolveAttachToOptions() {
      this._resolvedAttachTo = parseAttachTo(this);
      return this._resolvedAttachTo;
    }

    /**
     * A selector for resolved attachTo options.
     * @returns {{}|{element, on}}
     * @private
     */
    _getResolvedAttachToOptions() {
      if (this._resolvedAttachTo === null) {
        return this._resolveAttachToOptions();
      }
      return this._resolvedAttachTo;
    }

    /**
     * Check if the step is open and visible
     * @return {boolean} True if the step is open and visible
     */
    isOpen() {
      return Boolean(this.el && !this.el.hidden);
    }

    /**
     * Wraps `_show` and ensures `beforeShowPromise` resolves before calling show
     * @return {*|Promise}
     */
    show() {
      if (isFunction(this.options.beforeShowPromise)) {
        return Promise.resolve(this.options.beforeShowPromise()).then(() => this._show());
      }
      return Promise.resolve(this._show());
    }

    /**
     * Updates the options of the step.
     *
     * @param {Object} options The options for the step
     */
    updateStepOptions(options) {
      Object.assign(this.options, options);
      if (this.shepherdElementComponent) {
        this.shepherdElementComponent.$set({
          step: this
        });
      }
    }

    /**
     * Returns the element for the step
     * @return {HTMLElement|null|undefined} The element instance. undefined if it has never been shown, null if it has been destroyed
     */
    getElement() {
      return this.el;
    }

    /**
     * Returns the target for the step
     * @return {HTMLElement|null|undefined} The element instance. undefined if it has never been shown, null if query string has not been found
     */
    getTarget() {
      return this.target;
    }

    /**
     * Creates Shepherd element for step based on options
     *
     * @return {Element} The DOM element for the step tooltip
     * @private
     */
    _createTooltipContent() {
      const descriptionId = `${this.id}-description`;
      const labelId = `${this.id}-label`;
      this.shepherdElementComponent = new Shepherd_element({
        target: this.tour.options.stepsContainer || document.body,
        props: {
          classPrefix: this.classPrefix,
          descriptionId,
          labelId,
          step: this,
          styles: this.styles
        }
      });
      return this.shepherdElementComponent.getElement();
    }

    /**
     * If a custom scrollToHandler is defined, call that, otherwise do the generic
     * scrollIntoView call.
     *
     * @param {boolean|Object} scrollToOptions If true, uses the default `scrollIntoView`,
     * if an object, passes that object as the params to `scrollIntoView` i.e. `{ behavior: 'smooth', block: 'center' }`
     * @private
     */
    _scrollTo(scrollToOptions) {
      const {
        element
      } = this._getResolvedAttachToOptions();
      if (isFunction(this.options.scrollToHandler)) {
        this.options.scrollToHandler(element);
      } else if (isElement$1(element) && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView(scrollToOptions);
      }
    }

    /**
     * _getClassOptions gets all possible classes for the step
     * @param {Object} stepOptions The step specific options
     * @returns {String} unique string from array of classes
     * @private
     */
    _getClassOptions(stepOptions) {
      const defaultStepOptions = this.tour && this.tour.options && this.tour.options.defaultStepOptions;
      const stepClasses = stepOptions.classes ? stepOptions.classes : '';
      const defaultStepOptionsClasses = defaultStepOptions && defaultStepOptions.classes ? defaultStepOptions.classes : '';
      const allClasses = [...stepClasses.split(' '), ...defaultStepOptionsClasses.split(' ')];
      const uniqClasses = new Set(allClasses);
      return Array.from(uniqClasses).join(' ').trim();
    }

    /**
     * Sets the options for the step, maps `when` to events, sets up buttons
     * @param {Object} options The options for the step
     * @private
     */
    _setOptions(options) {
      if (options === void 0) {
        options = {};
      }
      let tourOptions = this.tour && this.tour.options && this.tour.options.defaultStepOptions;
      tourOptions = cjs({}, tourOptions || {});
      this.options = Object.assign({
        arrow: true
      }, tourOptions, options, mergeTooltipConfig(tourOptions, options));
      const {
        when
      } = this.options;
      this.options.classes = this._getClassOptions(options);
      this.destroy();
      this.id = this.options.id || `step-${uuid()}`;
      if (when) {
        Object.keys(when).forEach(event => {
          this.on(event, when[event], this);
        });
      }
    }

    /**
     * Create the element and set up the FloatingUI instance
     * @private
     */
    _setupElements() {
      if (!isUndefined(this.el)) {
        this.destroy();
      }
      this.el = this._createTooltipContent();
      if (this.options.advanceOn) {
        bindAdvance(this);
      }

      // The tooltip implementation details are handled outside of the Step
      // object.
      setupTooltip(this);
    }

    /**
     * Triggers `before-show`, generates the tooltip DOM content,
     * sets up a FloatingUI instance for the tooltip, then triggers `show`.
     * @private
     */
    _show() {
      this.trigger('before-show');

      // Force resolve to make sure the options are updated on subsequent shows.
      this._resolveAttachToOptions();
      this._setupElements();
      if (!this.tour.modal) {
        this.tour._setupModal();
      }
      this.tour.modal.setupForStep(this);
      this._styleTargetElementForStep(this);
      this.el.hidden = false;

      // start scrolling to target before showing the step
      if (this.options.scrollTo) {
        setTimeout(() => {
          this._scrollTo(this.options.scrollTo);
        });
      }
      this.el.hidden = false;
      const content = this.shepherdElementComponent.getElement();
      const target = this.target || document.body;
      target.classList.add(`${this.classPrefix}shepherd-enabled`);
      target.classList.add(`${this.classPrefix}shepherd-target`);
      content.classList.add('shepherd-enabled');
      this.trigger('show');
    }

    /**
     * Modulates the styles of the passed step's target element, based on the step's options and
     * the tour's `modal` option, to visually emphasize the element
     *
     * @param step The step object that attaches to the element
     * @private
     */
    _styleTargetElementForStep(step) {
      const targetElement = step.target;
      if (!targetElement) {
        return;
      }
      if (step.options.highlightClass) {
        targetElement.classList.add(step.options.highlightClass);
      }
      targetElement.classList.remove('shepherd-target-click-disabled');
      if (step.options.canClickTarget === false) {
        targetElement.classList.add('shepherd-target-click-disabled');
      }
    }

    /**
     * When a step is hidden, remove the highlightClass and 'shepherd-enabled'
     * and 'shepherd-target' classes
     * @private
     */
    _updateStepTargetOnHide() {
      const target = this.target || document.body;
      if (this.options.highlightClass) {
        target.classList.remove(this.options.highlightClass);
      }
      target.classList.remove('shepherd-target-click-disabled', `${this.classPrefix}shepherd-enabled`, `${this.classPrefix}shepherd-target`);
    }
  }

  /**
   * Cleanup the steps and set pointerEvents back to 'auto'
   * @param tour The tour object
   */
  function cleanupSteps(tour) {
    if (tour) {
      const {
        steps
      } = tour;
      steps.forEach(step => {
        if (step.options && step.options.canClickTarget === false && step.options.attachTo) {
          if (step.target instanceof HTMLElement) {
            step.target.classList.remove('shepherd-target-click-disabled');
          }
        }
      });
    }
  }

  /**
   * Generates the svg path data for a rounded rectangle overlay
   * @param {Object} dimension - Dimensions of rectangle.
   * @param {number} width - Width.
   * @param {number} height - Height.
   * @param {number} [x=0] - Offset from top left corner in x axis. default 0.
   * @param {number} [y=0] - Offset from top left corner in y axis. default 0.
   * @param {number | { topLeft: number, topRight: number, bottomRight: number, bottomLeft: number }} [r=0] - Corner Radius. Keep this smaller than half of width or height.
   * @returns {string} - Rounded rectangle overlay path data.
   */
  function makeOverlayPath(_ref) {
    let {
      width,
      height,
      x = 0,
      y = 0,
      r = 0
    } = _ref;
    const {
      innerWidth: w,
      innerHeight: h
    } = window;
    const {
      topLeft = 0,
      topRight = 0,
      bottomRight = 0,
      bottomLeft = 0
    } = typeof r === 'number' ? {
      topLeft: r,
      topRight: r,
      bottomRight: r,
      bottomLeft: r
    } : r;
    return `M${w},${h}\
H0\
V0\
H${w}\
V${h}\
Z\
M${x + topLeft},${y}\
a${topLeft},${topLeft},0,0,0-${topLeft},${topLeft}\
V${height + y - bottomLeft}\
a${bottomLeft},${bottomLeft},0,0,0,${bottomLeft},${bottomLeft}\
H${width + x - bottomRight}\
a${bottomRight},${bottomRight},0,0,0,${bottomRight}-${bottomRight}\
V${y + topRight}\
a${topRight},${topRight},0,0,0-${topRight}-${topRight}\
Z`;
  }

  /* src/js/components/shepherd-modal.svelte generated by Svelte v3.54.0 */
  function create_fragment(ctx) {
    let svg;
    let path;
    let svg_class_value;
    let mounted;
    let dispose;
    return {
      c() {
        svg = svg_element("svg");
        path = svg_element("path");
        attr(path, "d", /*pathDefinition*/ctx[2]);
        attr(svg, "class", svg_class_value = `${/*modalIsVisible*/ctx[1] ? 'shepherd-modal-is-visible' : ''} shepherd-modal-overlay-container`);
      },
      m(target, anchor) {
        insert(target, svg, anchor);
        append(svg, path);
        /*svg_binding*/
        ctx[11](svg);
        if (!mounted) {
          dispose = listen(svg, "touchmove", /*_preventModalOverlayTouch*/ctx[3]);
          mounted = true;
        }
      },
      p(ctx, _ref) {
        let [dirty] = _ref;
        if (dirty & /*pathDefinition*/4) {
          attr(path, "d", /*pathDefinition*/ctx[2]);
        }
        if (dirty & /*modalIsVisible*/2 && svg_class_value !== (svg_class_value = `${/*modalIsVisible*/ctx[1] ? 'shepherd-modal-is-visible' : ''} shepherd-modal-overlay-container`)) {
          attr(svg, "class", svg_class_value);
        }
      },
      i: noop,
      o: noop,
      d(detaching) {
        if (detaching) detach(svg);
        /*svg_binding*/
        ctx[11](null);
        mounted = false;
        dispose();
      }
    };
  }
  function _getScrollParent(element) {
    if (!element) {
      return null;
    }
    const isHtmlElement = element instanceof HTMLElement;
    const overflowY = isHtmlElement && window.getComputedStyle(element).overflowY;
    const isScrollable = overflowY !== 'hidden' && overflowY !== 'visible';
    if (isScrollable && element.scrollHeight >= element.clientHeight) {
      return element;
    }
    return _getScrollParent(element.parentElement);
  }

  /**
   * Get the visible height of the target element relative to its scrollParent.
   * If there is no scroll parent, the height of the element is returned.
   *
   * @param {HTMLElement} element The target element
   * @param {HTMLElement} [scrollParent] The scrollable parent element
   * @returns {{y: number, height: number}}
   * @private
   */
  function _getVisibleHeight(element, scrollParent) {
    const elementRect = element.getBoundingClientRect();
    let top = elementRect.y || elementRect.top;
    let bottom = elementRect.bottom || top + elementRect.height;
    if (scrollParent) {
      const scrollRect = scrollParent.getBoundingClientRect();
      const scrollTop = scrollRect.y || scrollRect.top;
      const scrollBottom = scrollRect.bottom || scrollTop + scrollRect.height;
      top = Math.max(top, scrollTop);
      bottom = Math.min(bottom, scrollBottom);
    }
    const height = Math.max(bottom - top, 0); // Default to 0 if height is negative
    return {
      y: top,
      height
    };
  }
  function instance($$self, $$props, $$invalidate) {
    let {
      element,
      openingProperties
    } = $$props;
    uuid();
    let modalIsVisible = false;
    let rafId = undefined;
    let pathDefinition;
    closeModalOpening();
    const getElement = () => element;
    function closeModalOpening() {
      $$invalidate(4, openingProperties = {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        r: 0
      });
    }
    function hide() {
      $$invalidate(1, modalIsVisible = false);

      // Ensure we cleanup all event listeners when we hide the modal
      _cleanupStepEventListeners();
    }
    function positionModal(modalOverlayOpeningPadding, modalOverlayOpeningRadius, scrollParent, targetElement) {
      if (modalOverlayOpeningPadding === void 0) {
        modalOverlayOpeningPadding = 0;
      }
      if (modalOverlayOpeningRadius === void 0) {
        modalOverlayOpeningRadius = 0;
      }
      if (targetElement) {
        const {
          y,
          height
        } = _getVisibleHeight(targetElement, scrollParent);
        const {
          x,
          width,
          left
        } = targetElement.getBoundingClientRect();

        // getBoundingClientRect is not consistent. Some browsers use x and y, while others use left and top
        $$invalidate(4, openingProperties = {
          width: width + modalOverlayOpeningPadding * 2,
          height: height + modalOverlayOpeningPadding * 2,
          x: (x || left) - modalOverlayOpeningPadding,
          y: y - modalOverlayOpeningPadding,
          r: modalOverlayOpeningRadius
        });
      } else {
        closeModalOpening();
      }
    }
    function setupForStep(step) {
      // Ensure we move listeners from the previous step, before we setup new ones
      _cleanupStepEventListeners();
      if (step.tour.options.useModalOverlay) {
        _styleForStep(step);
        show();
      } else {
        hide();
      }
    }
    function show() {
      $$invalidate(1, modalIsVisible = true);
    }
    const _preventModalBodyTouch = e => {
      e.preventDefault();
    };
    const _preventModalOverlayTouch = e => {
      e.stopPropagation();
    };

    /**
    * Add touchmove event listener
    * @private
    */
    function _addStepEventListeners() {
      // Prevents window from moving on touch.
      window.addEventListener('touchmove', _preventModalBodyTouch, {
        passive: false
      });
    }

    /**
    * Cancel the requestAnimationFrame loop and remove touchmove event listeners
    * @private
    */
    function _cleanupStepEventListeners() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
      window.removeEventListener('touchmove', _preventModalBodyTouch, {
        passive: false
      });
    }

    /**
    * Style the modal for the step
    * @param {Step} step The step to style the opening for
    * @private
    */
    function _styleForStep(step) {
      const {
        modalOverlayOpeningPadding,
        modalOverlayOpeningRadius
      } = step.options;
      const scrollParent = _getScrollParent(step.target);

      // Setup recursive function to call requestAnimationFrame to update the modal opening position
      const rafLoop = () => {
        rafId = undefined;
        positionModal(modalOverlayOpeningPadding, modalOverlayOpeningRadius, scrollParent, step.target);
        rafId = requestAnimationFrame(rafLoop);
      };
      rafLoop();
      _addStepEventListeners();
    }
    function svg_binding($$value) {
      binding_callbacks[$$value ? 'unshift' : 'push'](() => {
        element = $$value;
        $$invalidate(0, element);
      });
    }
    $$self.$$set = $$props => {
      if ('element' in $$props) $$invalidate(0, element = $$props.element);
      if ('openingProperties' in $$props) $$invalidate(4, openingProperties = $$props.openingProperties);
    };
    $$self.$$.update = () => {
      if ($$self.$$.dirty & /*openingProperties*/16) {
        $$invalidate(2, pathDefinition = makeOverlayPath(openingProperties));
      }
    };
    return [element, modalIsVisible, pathDefinition, _preventModalOverlayTouch, openingProperties, getElement, closeModalOpening, hide, positionModal, setupForStep, show, svg_binding];
  }
  class Shepherd_modal extends SvelteComponent {
    constructor(options) {
      super();
      init(this, options, instance, create_fragment, safe_not_equal, {
        element: 0,
        openingProperties: 4,
        getElement: 5,
        closeModalOpening: 6,
        hide: 7,
        positionModal: 8,
        setupForStep: 9,
        show: 10
      });
    }
    get getElement() {
      return this.$$.ctx[5];
    }
    get closeModalOpening() {
      return this.$$.ctx[6];
    }
    get hide() {
      return this.$$.ctx[7];
    }
    get positionModal() {
      return this.$$.ctx[8];
    }
    get setupForStep() {
      return this.$$.ctx[9];
    }
    get show() {
      return this.$$.ctx[10];
    }
  }

  const Shepherd = new Evented();

  /**
   * Class representing the site tour
   * @extends {Evented}
   */
  class Tour extends Evented {
    /**
     * @param {Object} options The options for the tour
     * @param {boolean} options.confirmCancel If true, will issue a `window.confirm` before cancelling
     * @param {string} options.confirmCancelMessage The message to display in the confirm dialog
     * @param {string} options.classPrefix The prefix to add to the `shepherd-enabled` and `shepherd-target` class names as well as the `data-shepherd-step-id`.
     * @param {Object} options.defaultStepOptions Default options for Steps ({@link Step#constructor}), created through `addStep`
     * @param {boolean} options.exitOnEsc Exiting the tour with the escape key will be enabled unless this is explicitly
     * set to false.
     * @param {boolean} options.keyboardNavigation Navigating the tour via left and right arrow keys will be enabled
     * unless this is explicitly set to false.
     * @param {HTMLElement} options.stepsContainer An optional container element for the steps.
     * If not set, the steps will be appended to `document.body`.
     * @param {HTMLElement} options.modalContainer An optional container element for the modal.
     * If not set, the modal will be appended to `document.body`.
     * @param {object[] | Step[]} options.steps An array of step options objects or Step instances to initialize the tour with
     * @param {string} options.tourName An optional "name" for the tour. This will be appended to the the tour's
     * dynamically generated `id` property.
     * @param {boolean} options.useModalOverlay Whether or not steps should be placed above a darkened
     * modal overlay. If true, the overlay will create an opening around the target element so that it
     * can remain interactive
     * @returns {Tour}
     */
    constructor(options) {
      if (options === void 0) {
        options = {};
      }
      super(options);
      autoBind(this);
      const defaultTourOptions = {
        exitOnEsc: true,
        keyboardNavigation: true
      };
      this.options = Object.assign({}, defaultTourOptions, options);
      this.classPrefix = normalizePrefix(this.options.classPrefix);
      this.steps = [];
      this.addSteps(this.options.steps);

      // Pass these events onto the global Shepherd object
      const events = ['active', 'cancel', 'complete', 'inactive', 'show', 'start'];
      events.map(event => {
        (e => {
          this.on(e, opts => {
            opts = opts || {};
            opts.tour = this;
            Shepherd.trigger(e, opts);
          });
        })(event);
      });
      this._setTourID();
      return this;
    }

    /**
     * Adds a new step to the tour
     * @param {Object|Step} options An object containing step options or a Step instance
     * @param {number} index The optional index to insert the step at. If undefined, the step
     * is added to the end of the array.
     * @return {Step} The newly added step
     */
    addStep(options, index) {
      let step = options;
      if (!(step instanceof Step)) {
        step = new Step(this, step);
      } else {
        step.tour = this;
      }
      if (!isUndefined(index)) {
        this.steps.splice(index, 0, step);
      } else {
        this.steps.push(step);
      }
      return step;
    }

    /**
     * Add multiple steps to the tour
     * @param {Array<object> | Array<Step>} steps The steps to add to the tour
     */
    addSteps(steps) {
      if (Array.isArray(steps)) {
        steps.forEach(step => {
          this.addStep(step);
        });
      }
      return this;
    }

    /**
     * Go to the previous step in the tour
     */
    back() {
      const index = this.steps.indexOf(this.currentStep);
      this.show(index - 1, false);
    }

    /**
     * Calls _done() triggering the 'cancel' event
     * If `confirmCancel` is true, will show a window.confirm before cancelling
     */
    cancel() {
      if (this.options.confirmCancel) {
        const cancelMessage = this.options.confirmCancelMessage || 'Are you sure you want to stop the tour?';
        const stopTour = window.confirm(cancelMessage);
        if (stopTour) {
          this._done('cancel');
        }
      } else {
        this._done('cancel');
      }
    }

    /**
     * Calls _done() triggering the `complete` event
     */
    complete() {
      this._done('complete');
    }

    /**
     * Gets the step from a given id
     * @param {Number|String} id The id of the step to retrieve
     * @return {Step} The step corresponding to the `id`
     */
    getById(id) {
      return this.steps.find(step => {
        return step.id === id;
      });
    }

    /**
     * Gets the current step
     * @returns {Step|null}
     */
    getCurrentStep() {
      return this.currentStep;
    }

    /**
     * Hide the current step
     */
    hide() {
      const currentStep = this.getCurrentStep();
      if (currentStep) {
        return currentStep.hide();
      }
    }

    /**
     * Check if the tour is active
     * @return {boolean}
     */
    isActive() {
      return Shepherd.activeTour === this;
    }

    /**
     * Go to the next step in the tour
     * If we are at the end, call `complete`
     */
    next() {
      const index = this.steps.indexOf(this.currentStep);
      if (index === this.steps.length - 1) {
        this.complete();
      } else {
        this.show(index + 1, true);
      }
    }

    /**
     * Removes the step from the tour
     * @param {String} name The id for the step to remove
     */
    removeStep(name) {
      const current = this.getCurrentStep();

      // Find the step, destroy it and remove it from this.steps
      this.steps.some((step, i) => {
        if (step.id === name) {
          if (step.isOpen()) {
            step.hide();
          }
          step.destroy();
          this.steps.splice(i, 1);
          return true;
        }
      });
      if (current && current.id === name) {
        this.currentStep = undefined;

        // If we have steps left, show the first one, otherwise just cancel the tour
        this.steps.length ? this.show(0) : this.cancel();
      }
    }

    /**
     * Show a specific step in the tour
     * @param {Number|String} key The key to look up the step by
     * @param {Boolean} forward True if we are going forward, false if backward
     */
    show(key, forward) {
      if (key === void 0) {
        key = 0;
      }
      if (forward === void 0) {
        forward = true;
      }
      const step = isString(key) ? this.getById(key) : this.steps[key];
      if (step) {
        this._updateStateBeforeShow();
        const shouldSkipStep = isFunction(step.options.showOn) && !step.options.showOn();

        // If `showOn` returns false, we want to skip the step, otherwise, show the step like normal
        if (shouldSkipStep) {
          this._skipStep(step, forward);
        } else {
          this.trigger('show', {
            step,
            previous: this.currentStep
          });
          this.currentStep = step;
          step.show();
        }
      }
    }

    /**
     * Start the tour
     */
    start() {
      this.trigger('start');

      // Save the focused element before the tour opens
      this.focusedElBeforeOpen = document.activeElement;
      this.currentStep = null;
      this._setupModal();
      this._setupActiveTour();
      this.next();
    }

    /**
     * Called whenever the tour is cancelled or completed, basically anytime we exit the tour
     * @param {String} event The event name to trigger
     * @private
     */
    _done(event) {
      const index = this.steps.indexOf(this.currentStep);
      if (Array.isArray(this.steps)) {
        this.steps.forEach(step => step.destroy());
      }
      cleanupSteps(this);
      this.trigger(event, {
        index
      });
      Shepherd.activeTour = null;
      this.trigger('inactive', {
        tour: this
      });
      if (this.modal) {
        this.modal.hide();
      }
      if (event === 'cancel' || event === 'complete') {
        if (this.modal) {
          const modalContainer = document.querySelector('.shepherd-modal-overlay-container');
          if (modalContainer) {
            modalContainer.remove();
          }
        }
      }

      // Focus the element that was focused before the tour started
      if (isHTMLElement$1(this.focusedElBeforeOpen)) {
        this.focusedElBeforeOpen.focus();
      }
    }

    /**
     * Make this tour "active"
     * @private
     */
    _setupActiveTour() {
      this.trigger('active', {
        tour: this
      });
      Shepherd.activeTour = this;
    }

    /**
     * _setupModal create the modal container and instance
     * @private
     */
    _setupModal() {
      this.modal = new Shepherd_modal({
        target: this.options.modalContainer || document.body,
        props: {
          classPrefix: this.classPrefix,
          styles: this.styles
        }
      });
    }

    /**
     * Called when `showOn` evaluates to false, to skip the step or complete the tour if it's the last step
     * @param {Step} step The step to skip
     * @param {Boolean} forward True if we are going forward, false if backward
     * @private
     */
    _skipStep(step, forward) {
      const index = this.steps.indexOf(step);
      if (index === this.steps.length - 1) {
        this.complete();
      } else {
        const nextIndex = forward ? index + 1 : index - 1;
        this.show(nextIndex, forward);
      }
    }

    /**
     * Before showing, hide the current step and if the tour is not
     * already active, call `this._setupActiveTour`.
     * @private
     */
    _updateStateBeforeShow() {
      if (this.currentStep) {
        this.currentStep.hide();
      }
      if (!this.isActive()) {
        this._setupActiveTour();
      }
    }

    /**
     * Sets this.id to `${tourName}--${uuid}`
     * @private
     */
    _setTourID() {
      const tourName = this.options.tourName || 'tour';
      this.id = `${tourName}--${uuid()}`;
    }
  }

  const isServerSide = typeof window === 'undefined';
  class NoOp {
    constructor() {}
  }
  if (isServerSide) {
    Object.assign(Shepherd, {
      Tour: NoOp,
      Step: NoOp
    });
  } else {
    Object.assign(Shepherd, {
      Tour,
      Step
    });
  }

  class ShepherdTour {

      tour = null;

      constructor() {


          this.tour = new Shepherd.Tour({
              useModalOverlay: true,
              keyboardNavigation: false,

              defaultStepOptions: {
                  classes: 'shadow-md bg-purple-dark',
                  scrollTo: true,
                  canClickTarget: false,
                  cancelIcon: {
                      enabled: true
                  },
                  buttons: [
                      {
                          text: 'Next',
                          action() {
                              return this.next()
                          }
                      }
                  ]
              }
          });

          ['cancel', 'complete'].forEach(eventName => this.tour.on(eventName, () => {
              localStorage.setItem('ct-tour-seen', 'true');
              if (document.querySelectorAll('.list-chapter').length > 0 && confirm('reset app?')) {
                  window.dispatchEvent(new CustomEvent('generic:reset'));
              }
          }));


          window.addEventListener('keyup', e => {
              if (e.key === 'ArrowRight' && this.tour.isActive()) {
                  this.tour.next();
              }
          });

          this.tour.addSteps([
              {
                  id: 'describe-timeline',
                  text: 'Clicking anywhere on the timeline brings up the marker.',
                  attachTo: {
                      element: '.timeline',
                      on: 'bottom'
                  },
              }, {
                  id: 'describe-timeline-insert-button',
                  text: 'The <i class="bi bi-bookmark-plus"></i> button creates a new chapter at the selected time.',
                  attachTo: {
                      element: function () {
                          return '.timeline .marker .btn-group .insert';
                      },
                      on: 'bottom'
                  },

                  beforeShowPromise() {
                      return new Promise(function (resolve) {
                          window.timeline.updateMarker(document.querySelector('.timeline').getBoundingClientRect().width * .5, 0.5);
                          setTimeout(() => {
                              resolve();
                          }, 120);

                      });
                  },

                  when: {
                      hide() {
                          document.querySelector('.timeline').classList.remove('clicked');
                      }
                  }
              }, {
                  id: 'show-new-chapter-in-timeline',
                  text: 'The new chapter has been added below the timeline as a segment&hellip;',
                  attachTo: {
                      element: function () {
                          return '.chapters .chapter';
                      },
                      on: 'bottom'
                  },
                  beforeShowPromise() {
                      return new Promise(function (resolve) {
                          window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: 1800}}));
                          setTimeout(() => {
                              resolve();
                          }, 120);

                      });
                  }
              }, {
                  id: 'show-new-chapter-in-list',
                  text: '&hellip; and is also rendered in the chapter list on the left.',
                  attachTo: {
                      element: function () {
                          return '.list-chapter';
                      },
                      on: 'bottom'
                  }
              }, {
                  id: 'show-lower-add-button',
                  text: 'You can add chapters from the chapter list before and after existing chapters.',
                  attachTo: {
                      element: function () {
                          return [...document.querySelectorAll('.add-chapter-in-list-btn')].pop();
                      },
                      on: 'bottom'
                  }
              }, {
                  id: 'show-new-chapters-in-timeline',
                  text: 'All chapters are shown as segments below the timeline. Clicking a segment selects a chapter.',
                  attachTo: {
                      element: function () {
                          return '.chapters';
                      },
                      on: 'bottom'
                  },
                  beforeShowPromise() {
                      return new Promise(function (resolve) {
                          window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: 0}}));
                          window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: 3600 * 0.75}}));
                          setTimeout(() => {
                              resolve();
                          }, 120);
                      });
                  }
              }, {
                  id: 'show-edit-box',
                  text: 'Once selected, you can edit a chapter\'s attributes here.',
                  attachTo: {
                      element: function () {
                          return '[x-ref="chapterList"]+div';
                      },
                      on: 'left'
                  }
              }, {
                  id: 'show-timestampedit-button',
                  text: 'Edit a chapter\'s timestamp by either clicking this button, the chapter\'s timestamp link in the list or by dragging the chapter segment\'s left edge.',
                  attachTo: {
                      element: function () {
                          return '#chapterStartTime';
                      },
                      on: 'left'
                  }
              }, {
                  id: 'show-timestampedit-dialog',
                  text: 'Once the chapter\'s timestamp is updated, the timeline and chapter list are also updated. Expanding a chapters timestamp beyond the current duration will expand the duration.',
                  attachTo: {
                      element: function () {
                          return '#timestampEditDialog';
                      },
                      on: 'top'
                  },
                  beforeShowPromise() {
                      return new Promise(function (resolve) {
                          document.querySelector('#timestampEditDialog').addEventListener('shown.bs.offcanvas', function () {
                              resolve();
                          });
                          document.querySelector('#chapterStartTime').click();
                      });
                  },

              }, {
                  id: 'show-close-button',
                  text: 'Close the chapter edit dialog here to return to the main menu.',
                  attachTo: {
                      element: function () {
                          return '[x-ref="chapterList"]+div .nav-item.ms-auto';
                      },
                      on: 'left'
                  },

                  beforeShowPromise() {
                      document.querySelector('#chapterStartTime').click();
                      return new Promise(function (resolve) {
                          document.querySelector('#timestampEditDialog input').value = '00:50:00';
                          document.querySelector('#timestampEditDialog .offcanvas-body button').click();

                          resolve();

                      });
                  }
              }, {
                  id: 'explain-main-menu',
                  text: 'Access features that are not related to single chapters from here.',
                  attachTo: {
                      element: '[x-ref="chapterList"]+div .text-center',
                      on: 'left'
                  },
                  beforeShowPromise: function () {
                      return new Promise(function (resolve) {
                          document.querySelector('[x-ref="chapterList"]+div .nav-item.ms-auto a').click();
                          setTimeout(() => {
                              resolve();
                          }, 120);
                      });
                  }
              }, {
                  id: 'explain-navi-toggle',
                  text: 'The same features can be accessed at any time from the offcanvas menu.',
                  attachTo: {
                      element: 'header .flex-column',
                      on: 'left'
                  }
              }, {
                  id: 'show-open-navi',
                  text: 'Let\'s focus on the export feature.',
                  attachTo: {
                      element: '#navi .offcanvas-export-link',
                      on: 'left'
                  },
                  beforeShowPromise: function () {
                      return new Promise(function (resolve) {
                          document.querySelector('#navi').addEventListener('shown.bs.offcanvas', function () {
                              resolve();
                          });
                          document.querySelector('header .flex-column a').click();
                      });
                  }
              }, {
                  id: 'show-format-tabs',
                  text: 'Select an export format.',
                  attachTo: {
                      element: '#exportDialog .nav',
                      on: 'top'
                  },
                  beforeShowPromise: function () {
                      return new Promise(function (resolve) {
                          document.querySelector('#exportDialog').addEventListener('shown.bs.offcanvas', function () {
                              resolve();
                          });
                          document.querySelector('#navi .offcanvas-export-link').click();
                      });
                  }
              }, {
                  id: 'show-export-options',
                  text: 'Toggle export settings if needed. The output will be updated immediately.',
                  attachTo: {
                      element: '#exportDialog .col-4',
                      on: 'left'
                  }
              }, {
                  id: 'show-export-options',
                  text: 'Finally, download the data or copy it to the clipboard.',
                  attachTo: {
                      element: '#exportDialog .col-8 > div',
                      on: 'top'
                  }
              }, {
                  id: 'done',
                  text: 'That\s it. You can run this tour again from the offcanvas navigation at any time. Have fun.',
                  attachTo: {
                      on: 'center'
                  },
                  buttons: [
                      {
                          text: 'Done',
                          action() {
                              return this.next();
                          }
                      }
                  ]
              }
          ]);





      }

      show() {
          console.log('A');
          if (!localStorage.getItem('ct-tour-seen') || /show-tour/.test(window.location.hash)) {
              window.location.hash = '';
              this.tour.start();
          }
      }
  }

  function SWInclude(){
      (async () => {
          if ("serviceWorker" in navigator) {
              try {
                  const registration = await navigator.serviceWorker.register("/sw.js", {
                      scope: "/",
                  });
                  if (registration.installing) {
                      console.log("Service worker installing");
                  } else if (registration.waiting) {
                      console.log("Service worker installed");
                  } else if (registration.active) {
                      console.log("Service worker active");
                  }
              } catch (error) {
                  console.error(`Registration failed with ${error}`);
              }
          }
      })();
  }

  window.Alpine = module_default;


  SWInclude();

  window.GAIsDeployed = false;
  window.deployGA = () => {

      if (window.GAIsDeployed) {
          return;
      }

      const script = document.createElement('script');
      [
          ['async', true],
          ['src', `https://www.googletagmanager.com/gtag/js?id=${window.GACODE}`]
      ].forEach(([key, value]) => script.setAttribute(key, value));

      document.body.insertAdjacentElement('beforeend', script);
      window.GAIsDeployed = true;
  };

  window.dataLayer = window.dataLayer || [];

  window.gtag = function () {
      window.dataLayer.push(arguments);
  };

  gtag('js', new Date());
  gtag('set', {
      'page_title': 'chaptertool'
  });


  window.addEventListener('DOMContentLoaded', () => {
      document.documentElement.dataset.bsTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      window.timeline = new Timeline(3600, [], document.querySelector('.timeline'));
      module_default.start();


      window.st = new ShepherdTour();


      fetch('ga-code').then(r => r.text())
          .then(code => {
              window.GACODE = code;
              if (!localStorage.getItem('ct-analytics-state')) {
                  (new Offcanvas(document.querySelector('#analyticsDialog'), {
                      keyboard: false,
                      backdrop: 'static'
                  })).show();
              }
              if (localStorage.getItem('ct-analytics-state') === 'enabled') {
                  window.deployGA();
              }
          });
  });

  window.APP = {
      ...{
          chapters: [],
          data: new ChaptersJson(),
          editTimestampLabel: '',
          editTimestampTimestamp: [0, 0],
          editTimestampCallback: null,
          editTimestampBounds: {min: 0, max: '10:10:10'},
          editTimestampChapter: 0,
          currentChapterIndex: null,
          fileHandler: false,
          editTab: 'info',
          chapterBelowIndex: false,
          chapterLock: true,
          offcanvasNavi: null,
          analyticsEnabled: false,
          analyticsIsAvailable: false,
          versionString: '',

          init() {


              fetch('version').then(r => r.text())
                  .then(version => this.versionString = `Version ${version}`);


              this.offcanvasNavi = new Offcanvas(this.$refs.navi);
              this.$refs.navi.addEventListener('show.bs.offcanvas', () => {
                  gtag('event', 'navi', 'show');
              });


              this.tooltip = new Tooltip(document.body, {
                  selector: '.has-tooltip',
                  animation: false,
                  //placement: 'aut',
                  trigger: 'hover',
                  html: true,
                  customClass: 'small'
              });

              this.analyticsEnabled = localStorage.getItem('ct-analytics-state') === 'enabled';

              setTimeout(() => {
                  this.analyticsIsAvailable = !!window.GACODE;
              }, 1000);

              this.fileHandler = new FileHandler();

              this.timestampOffcanvas = new Offcanvas(this.$refs.timestampedit);
              this.$refs.timestampedit.addEventListener('shown.bs.offcanvas', () => {
                  this.$refs.timestampedit.querySelector('[type=time]').focus();
              });

              this.$refs.timestampedit.querySelector('form').addEventListener('submit', e => {
                  e.preventDefault();
                  this.editTimestampCallback(Array.from(e.target.querySelectorAll('input')).map(i => i.value).join('.'));
                  this.timestampOffcanvas.hide();
              });


              window.addEventListener('timeline:add', e => {
                  this.addChapterAtTime(e.detail.startTime, {}, 'timeline');
              });

              window.addEventListener('timeline:move', e => {
                  this.updateChapterStartTime(parseInt(e.detail.index), secondsToTimestamp(e.detail.startTime), true, 'dragdrop');
              });

              window.addEventListener('timeline:scrollintoview', e => {
                  this.editChapter(e.detail.index);
              });

              window.addEventListener('dragndrop:video', e => {
                  if (this.data.chapters.length > 0 || this.hasVideo || this.hasAudio) {
                      this.showImportDialog({
                          mode: 'video',
                          video: e.detail.video,
                          name: e.detail.name
                      });
                      return;
                  }

                  this.attachVideo(e.detail.video);
              });

              window.addEventListener('dragndrop:audio', e => {
                  this.attachAudio(e.detail.audio);
              });


              window.addEventListener('generic:reset', e => {
                  this.reset();
              });


              window.addEventListener('dragndrop:image', e => {
                  if (this.currentChapterIndex !== null) {
                      this.data.chapters[this.currentChapterIndex].img_type = e.detail.type || 'blob';
                      this.data.chapters[this.currentChapterIndex].img = e.detail.image;
                      this.data.chapters[this.currentChapterIndex].img_filename = e.detail.name;

                      this.getImageInfo(this.currentChapterIndex);

                  }
              });

              window.addEventListener('timeline:marker-set', e => {

                  if (!this.chapterLock) {
                      return;
                  }

                  const index = this.data.chapterIndexFromTime(e.detail.time);
                  if (index !== false) {
                      this.editChapter(index);
                  } else {
                      this.closeChapter();
                  }
              });

              window.addEventListener('dragndrop:jsonfail', () => {
                  this.toast('file could not be processed :/');
              });

              window.addEventListener('dragndrop:json', e => {
                  if (this.data.chapters.length > 0 || this.hasVideo || this.hasAudio) {
                      this.showImportDialog({
                          mode: 'data',
                          data: e.detail.data,
                          name: e.detail.name
                      });
                      return;
                  }
                  this.newProject(e.detail.data);
              });

              this.initExportDialog();
              this.initChapterDialog();
              this.initImportDialog();
          },

          toggleGA(state /* undefined|enabled|disabled */) {
              let hasState = true;
              let currentState = localStorage.getItem('ct-analytics-state');
              if (!currentState) {
                  hasState = false;
                  window.st.show();
              }
              if (!state) {
                  state = currentState === 'disabled' ? 'enabled' : 'disabled';
              }

              localStorage.setItem('ct-analytics-state', state);
              this.analyticsEnabled = state === 'enabled';

              if (state === 'enabled') {
                  window.deployGA();
              }

              Offcanvas.getInstance(document.querySelector('#analyticsDialog'))?.hide();

              if (!hasState) {
                  this.toast(`analytics ${state}`);
              } else {
                  this.toast(`analytics ${state} - reload page for it to take effect`);
              }
          },

          askForNewProject() {
              if (this.data.chapters.length > 0 && !confirm('discard current project?')) {
                  gtag('event', 'askForNew', 'reject');
                  return;
              }
              gtag('event', 'askForNew', 'confirm');
              this.newProject();
          },

          newProject(data) {
              gtag('event', 'createNew');
              this.reset();
              this.$nextTick(() => {
                  this.data = data || new ChaptersJson();
                  this.updateTimeline();
                  this.importModal.hide();
              });
          },

          scrollChapterIntoView(index) {
              this.$refs.chapterList.querySelectorAll('.list-chapter')[index].scrollIntoView({block: 'center'});
          },

          editChapter(index) {
              this.$nextTick(() => {
                  this.scrollChapterIntoView(index);
                  this.currentChapterIndex = index;
                  window.timeline.setActive(index);
              });
          },

          toast(message, options = {}) {

              [...this.$refs.toasts.querySelectorAll('.toast.show')].slice(1).forEach(node => {
                  node.classList.remove('show');
                  node.classList.add('hide');
              });

              this.$refs.toasts.insertAdjacentHTML('afterbegin', `
                <div style="--bs-toast-spacing:0.5rem" class="toast small" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-body px-2 py-1">${message}</div>
                </div>
            `);
              (new Toast(this.$refs.toasts.querySelector('.toast'), {
                  ...{
                      delay: 1666
                  }, ...options
              })).show();
          },

          changeDuration() {
              this.editTimestamp(
                  `Edit Duration`,
                  this.data.duration,
                  {
                      max: '23:59:59',
                      min: secondsToTimestamp(this.data.chapters.at(-1) ? this.data.chapters.at(-1).startTime : 0).slice(0, 8)
                  },
                  (newTimestamp) => {
                      gtag('event', 'durationChange');
                      this.data.duration = timestampToSeconds(newTimestamp);
                      this.data.bump(true);
                      this.updateTimeline();
                  }
              );
          },
          editStartTime(chapterIndex) {
              this.editTimestampChapter = chapterIndex;
              this.editTimestamp(
                  `Set chapter ${chapterIndex + 1} startTime`,
                  this.data.chapters[chapterIndex].startTime,
                  {max: '23:59:59', min: 0},
                  newTimestamp => this.updateChapterStartTime(this.editTimestampChapter, newTimestamp, false)
              );
          },


          updateChapterStartTime(index, startTime, forceEdit = false, origin = 'dialog') {
              gtag('event', 'startTimeChange', origin);

              const result = this.data.updateChapterStartTime(index, startTime);
              if (result === 'timeInUse') {
                  this.toast(`Given start time already in use`);
                  return;
              }
              this.updateTimeline();
              const newIndex = this.data.chapterIndexFromStartTime(result);
              if (forceEdit) {
                  this.editChapter(newIndex);
              } else {
                  if (this.currentChapterIndex && this.currentChapterIndex === index && newIndex !== index) {
                      this.editChapter(newIndex);
                  }
              }
              if (newIndex !== index) {
                  this.toast(`moved chapter ${index + 1} to posiiton ${newIndex + 1}, and set start time to ${startTime}`);
              } else {
                  this.toast(`changed chapter #${index + 1} start time to ${startTime}`);
              }
          },

          chapterImage(index) {
              if (!this.data.chapters[index] || !this.data.chapters[index].img) {
                  return false;
              }

              try {
                  new URL(this.data.chapters[index].img);
              } catch (e) {
                  return false;
              }

              return this.data.chapters[index].img;
          },

          deleteChapter(index) {
              this.currentChapterIndex = null;
              gtag('event', 'deleteChapter');
              this.$nextTick(() => {
                  this.data.remove(index);
                  this.updateTimeline();
                  document.querySelector('.tooltip')?.remove();
                  this.toast(`deleted chapter #${index + 1}`);
              });
          },

          addChapterAtTime(startTime, options = {}, origin) {
              gtag('event', 'addChapterAtTime', origin);
              let chapter = {};
              if (options.title?.length > 0) {
                  chapter.title = options.title;
              }

              if ('image' in options) {
                  chapter.img = options.image;
                  chapter.img_type = 'blob';
                  chapter.img_filename = new URL(options.image).pathname + '.jpg';
              }

              const result = this.data.addChapterAtTime(startTime, chapter);
              if (!result) {
                  this.toast(`a chapter already exists at ${secondsToTimestamp(startTime)}`);
                  return;
              }

              this.$nextTick(() => {
                  this.updateTimeline();
                  this.currentChapterIndex = this.data.chapterIndexFromStartTime(startTime);
                  this.editChapter(this.currentChapterIndex);

                  if (!('image' in options) && this.hasVideo) {
                      //this depends on currentChapterIndex being set by editChapter
                      this.fetchVideoSnapshot(startTime);
                  }

                  this.toast(`added chapter at ${secondsToTimestamp(startTime)}`);
              });
          },

          addChapter(index) {
              if (index === 0 && this.data.chapters[0] && this.data.chapters[0].startTime === 0) {
                  this.toast(`a chapter already exists at ${secondsToTimestamp(0)}`);
                  return;
              }

              gtag('event', 'addChapterAtIndex');

              let startTime = this.data.addChapterAt(index);
              this.updateTimeline();

              this.toast(`added chapter at position ${index + 1} (${secondsToTimestamp(startTime)})`);

              this.$nextTick(() => {
                  this.editChapter(index === Infinity ? this.data.chapters.length - 1 : index);
                  if (this.hasVideo) {
                      //this depends on currentChapterIndex being set by editChapter
                      this.fetchVideoSnapshot(startTime);
                  }
              });
          },

          //wraps util feature to expose to alpine template
          secondsToTimestamp(seconds) {
              return secondsToTimestamp(seconds)
          },

          updateTimeline() {
              this.fileHandler.editorHasProject = this.data.chapters.length > 0;
              window.timeline.setDuration(this.data.duration);
              window.timeline.setChapters(JSON.parse(JSON.stringify(this.data.chapters)));
          },

          editTimestamp(label, timestamp, bounds, callback) {
              if (parseFloat(timestamp) === timestamp) {
                  timestamp = secondsToTimestamp(timestamp, {milliseconds: true});
              }

              this.editTimestampLabel = label;
              this.editTimestampBounds = bounds;
              this.editTimestampTimestamp = timestamp.split('.');

              this.editTimestampCallback = callback;
              this.timestampOffcanvas.show();
          },

          reset() {

              this.offcanvasNavi.hide();
              this.chapterDialog.hide();
              this.exportOffcanvas.hide();
              this.timestampOffcanvas.hide();
              this.importModal.hide();

              this.data.chapters.forEach(chapter => {
                  if (chapter.img && chapter.img.slice(0, 5) === 'blob:') {
                      URL.revokeObjectURL(chapter.img);
                  }
              });

              document.querySelectorAll('[src^=blob]').forEach(node => {
                  console.log('revoking url...');
                  URL.revokeObjectURL(node.getAttribute('src'));
              });

              this.actualMediaDuration = null;
              this.chapterLock = true;
              this.currentChapterIndex = null;
              this.data = new ChaptersJson();
              this.hasVideo = false;
              this.hasAudio = false;
              this.mediaIsCollapsed = false;
              this.fileHandler.editorHasProject = false;
              window.timeline.setMarkerAt(0);
              window.timeline.node.classList.remove('clicked');
          },

          closeChapter() {
              gtag('event', 'closeChapter');
              this.$nextTick(() => {
                  this.currentChapterIndex = null;
                  window.timeline.setActive(false);
              });
          },

          expandToFirstToStart() {
              gtag('event', 'startTimeChange', 'expand');
              this.data.expandFirstToStart();
              this.updateTimeline();
          },

          addChapterFromTime() {
              this.editTimestamp(
                  `Add chapter at time`,
                  this.data.duration * .5,
                  {max: '23:59:59', min: 0},
                  newTimestamp => this.addChapterAtTime(timestampToSeconds(newTimestamp), {}, 'dialog')
              );
          },
          adaptDuration() {
              gtag('event', 'adaptDuration');
              this.data.duration = this.actualMediaDuration;
              this.data.bump(true);
              this.updateTimeline();
              this.toast(`duration set to (${secondsToTimestamp(this.actualMediaDuration)})`);
              this.actualMediaDuration = null;
          },
          toggleChapterLock() {
              this.chapterLock = !this.chapterLock;
              gtag('event', 'toggleChapterLock', this.chapterLock ? 'locked' : 'unlocked');
          },
          showTourAgain() {
              if (this.data.chapters.length === 0 || (this.data.chapters.length > 0 && confirm('abandon current project?'))) {
                  const url = new URL(window.location);
                  url.hash = 'show-tour';
                  window.location = url.toString();
                  location.reload();

              }
          }
      },
      ...MediaFeatures,
      ...ExportFeatures,
      ...ChapterFeatures,
      ...ImportDialog
  };

}));
