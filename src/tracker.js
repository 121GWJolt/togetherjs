(function () {

  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;
  var assert = TowTruck.assert;

  TowTruck.initTrackers = function initTrackers() {
    if (! initTrackers.done) {
      TowTruck.trackers.createAll();
      initTrackers.done = true;
    }
    TowTruck.send({type: "reset-trackers"});
    TowTruck.trackers.introduceAll();
  };

  TowTruck.messageHandler.on("hello hello-back", function () {
    if (! TowTruck.isClient) {
      TowTruck.initTrackers();
    }
  });

  TowTruck.messageHandler.on("reset-trackers", function () {
    TowTruck.trackers.reset();
  });
  
  TowTruck.messageHandler.on("connect-tracker", function (msg) {
    TowTruck.trackers.connect(msg);
  });

  // This is a kind of registry for trackers.
  // Each item here is a class, with the following methods:
  // * .createAll(): a class method, that finds and instantiates
  //   all trackers.  This will only be called on the master browser, not 
  //   the client.
  // * All trackers classes have a .className property (if you give the
  //    constructor a name that will be used)
  // * On instantiation all trackers get added to TowTruck.trackers.active 
  //   array
  // * Trackers have a .introduce() method.  This should send an introduction
  //   message, with type: "connect-tracker", and trackerType: Tracker.name
  // * Tracker.fromConnect(msg) creates a tracker, using the message sent
  //   from .introduce()
  TowTruck.trackers = {
    _trackers: Object.create(null),
    active: [],
    get: function (name) {
      return this._trackers[name];
    },
    register: function (Tracker) {
      var name = Tracker.className;
      if (! name) {
        throw 'Bad Tracker, has no name: ' + Tracker;
      }
      if ((! Tracker.createAll) || (! Tracker.fromConnect) ||
          (! Tracker.prototype.introduce) ||
          (! Tracker.prototype.destroy)) {
        throw 'Bad Tracker: does not implement interface (' + name + ')';
      }
      if (this._trackers[name]) {
        throw "Tracker already registered under " + name;
      }
      this._trackers[name] = Tracker;
    },
    introduceAll: function () {
      for (var i=0; i<this.active.length; i++) {
        this.active[i].introduce();
      }
    },
    createAll: function () {
      for (var name in this._trackers) {
        this._trackers[name].createAll();
      }
    },
    reset: function () {
      assert(TowTruck.isClient);
      while (this.active.length) {
        this.active[0].destroy();
      }
    },
    connect: function (msg) {
      var name = msg.trackerType;
      var Tracker = this.get(name);
      if (! Tracker) {
        console.warn("Got a connect for a tracker type I don't understand: " + name);
        return;
      }
      Tracker.fromConnect(msg);
    }
  };

  TowTruck.TextTracker = TowTruck.Class({

    constructor: function TextTracker(options) {
      this.element = $(options.element);
      this.id = this.element.attr("id");
      this.isClient = options.isClient;
      this.channel = options.channel;
      this.curState = this.getState();
      if (! this.isClient) {
        this.sendInit();
      }
      this.change = this.change.bind(this);
      this.onmessage = this.onmessage.bind(this);
      this.channel.on("message", this.onmessage);
      this.bindChange();
    },

    textareaEvents: ["textInput", "keydown", "keyup", "select", "cut", "paste"],

    bindChange: function () {
      this.textareaEvents.forEach(function (e) {
        this.element.bind(e, this.change);
      }, this);
    },

    unbindChange: function () {
      this.textareaEvents.forEach(function (e) {
        this.element.unbind(e, this.change);
      }, this);
    },

    getState: function () {
      return this.element.val();
    },

    applyChange: function (value) {
      this.element.val(value);
      this.curState = value;
    },

    introduce: function () {
      TowTruck.send({
        type: "connect-tracker",
        trackerType: this.constructor.name,
        routeId: this.channel.id,
        elementId: this.id
      });
    },

    destroy: function () {
      this.unbindChange();
      var index = TowTruck.trackers.active.indexOf(this);
      if (index != -1) {
        TowTruck.trackers.active.splice(index, 1);
      }
      this.channel.close();
    },

    change: function () {
      var newValue = this.getState();
      var old = this.curState;
      if (newValue == old) {
        return;
      }
      var commonStart = 0;
      while (commonStart < newValue.length &&
             newValue.charAt(commonStart) == old.charAt(commonStart)) {
        commonStart++;
      }
      var commonEnd = 0;
      while (commonEnd < (newValue.length - commonStart) &&
             newValue.charAt(newValue.length - commonEnd - 1) ==
             old.charAt(old.length - commonEnd - 1)) {
        commonEnd++;
      }
      var removed = old.substr(commonStart, old.length - commonStart - commonEnd);
      this.channel.send({
        op: "change",
        start: commonStart,
        end: old.length-commonEnd,
        text: newValue.substr(commonStart, newValue.length - commonStart - commonEnd),
        oldLength: old.length,
        newLength: newValue.length,
        removed: removed,
        // FIXME: these are for debugging:
        oldText: old,
        fullText: newValue
      });
      this.curState = newValue;
    },

    sendInit: function () {
      this.channel.send({op: "init", value: this.curState});
    },

    onmessage: function (msg) {
      if (msg.op == "init") {
        this.curState = msg.text;
        this.applyChange(msg.text);
        return;
      }
      if (msg.op == "change") {
        if (msg.oldLength != this.curState.length) {
          throw "Length mismatch: is " + (this.curState.length) + " not " + msg.oldLength;
        }
        var removed = this.curState.substr(msg.start, msg.end - msg.start);
        if (removed != msg.removed) {
          throw "Removed text is " + JSON.stringify(removed) + " not " + JSON.stringify(msg.removed);
        }
        var newValue = (
          this.curState.substr(0, msg.start) +
          msg.text +
          this.curState.substr(msg.end));
        if (newValue.length != msg.newLength) {
          throw "New length is " + newValue.length + " not " + msg.newLength;
        }
        if (msg.oldText && this.curState != msg.oldText) {
          throw "Current value mismatch";
        }
        if (msg.newText && newValue != msg.newText) {
          throw "New value mismatch";
        }
        this.curState = newValue;
        var startPos = this.element[0].selectionStart;
        var endPos = this.element[0].selectionEnd;
        this.applyChange(newValue);
        if (startPos > msg.start) {
          if (startPos < msg.end) {
            // it was in a deleted/changed portion:
            this.element[0].selectionStart = msg.start;
          } else {
            // it was after the change:
            this.element[0].selectionStart = startPos + (msg.text.length - removed.length);
          }
        }
        if (endPos > msg.start) {
          if (endPos < msg.end) {
            this.element[0].selectionEnd = msg.start;
          } else {
            this.element[0].selectionEnd = endPos + (msg.text.length - removed.length);
          }
        }
        return;
      }
    }

  });

  TowTruck.TextTracker.createAll = function () {
    // These are all the text-like inputs we control in a granular manner
    // (as opposed to fields that we just overwrite, like type=checkbox)
    assert(! TowTruck.isClient);
    var els = $(
      'textarea:visible[id], ' +
        'input:visible[id][type="text"], ' +
        'input:visible[id][type="search"], ' +
        'input:visible[id][type="url"]');
    els.each(function () {
      var routeId = "tracker-textarea-" + TowTruck.safeClassName(this.id);
      var route = TowTruck.router.makeRoute(routeId);
      var t = TowTruck.TextTracker({
        element: this,
        channel: route,
        isClient: false
      });
      TowTruck.trackers.active.push(t);
    });
  };

  TowTruck.TextTracker.fromConnect = function (msg) {
    if (! TowTruck.isClient) {
      throw "fromConnect should only be called by the client";
    }
    var id = msg.elementId;
    var el = $("#" + id);
    if (! el.length) {
      console.warn("Cannot find local element with id #" + id);
      return;
    }
    var route = TowTruck.router.makeRoute(msg.routeId);
    var t = TowTruck.TextTracker({
      element: el,
      channel: route,
      isClient: true
    });
    TowTruck.trackers.active.push(t);
  };

  TowTruck.trackers.register(TowTruck.TextTracker);

  TowTruck.FormFieldTracker = TowTruck.Class({
    constructor: function FormFieldTracker(options) {
      this.channel = options.channel;
      this.isClient = options.isClient;
      this.change = this.change.bind(this);
      this.onmessage = this.onmessage.bind(this);
      this.channel.on("message", this.onmessage);
      // Not file, hidden, button, image, password, reset, submit
      // Not text types (we want collision handling):
      //   text, search, url
      var types = (
        "checkbox color date datetime datetime-local email " +
          "month number radio range tel time week").split(/ /g);
      var selectors = [];
      types.forEach(function (t) {
        selectors.push('input[type="' + t + '"]');
      });
      selectors.push("select");
      this._selector = selectors.join(", ");
      $(document).on("change", this._selector, this.change);
    },

    destroy: function () {
      $(document).off("change", this._selector, this.change);
      var index = TowTruck.trackers.active.indexOf(this);
      if (index != -1) {
        TowTruck.trackers.active.splice(index, 1);
      }
      this.channel.close();
    },
    
    introduce: function () {
      assert(! this.isClient);
      TowTruck.send({
        type: "connect-tracker",
        trackerType: this.constructor.name,
        routeId: this.channel.id
      });
    },

    _checkedFields: ["radio", "checkbox"],
    
    change: function (event) {
      var el = $(event.target);
      // FIXME: we should allow elements that have names or other
      // identifying information besides ids
      if (! el.attr("id")) {
        return;
      }
      // FIXME: should check for case issues:
      var isChecked = this._checkedFields.indexOf(el.attr("type")) != -1;
      var msg = {
        op: "change",
        elementId: el.attr("id"),
        value: el.val()
      };
      if (isChecked) {
        msg.checked = el[0].checked;
      }
      this.channel.send(msg);
    },

    onmessage: function (msg) {
      assert(msg.op == "change", msg);
      var element = $("#" + msg.elementId);
      if (! element.length) {
        console.warn("Got form field change op for ID", msg.elementId,
                     "but that element does not exist");
        return;
      }
      element.val(msg.value);
      if (msg.checked !== undefined) {
        element[0].checked = msg.checked;
      }
    }
  });

  TowTruck.FormFieldTracker.createAll = function () {
    assert(! TowTruck.isClient, "shouldn't be client");
    var route = TowTruck.router.makeRoute("tracker-formfield");
    var t = TowTruck.FormFieldTracker({
      channel: route,
      isClient: false
    });
    TowTruck.trackers.active.push(t);
  };

  TowTruck.FormFieldTracker.fromConnect = function (msg) {
    assert(TowTruck.isClient, "should be client");
    var route = TowTruck.router.makeRoute(msg.routeId);
    var t = TowTruck.FormFieldTracker({
      channel: route,
      isClient: true
    });
    TowTruck.trackers.active.push(t);
  };

  TowTruck.trackers.register(TowTruck.FormFieldTracker);
  
})();
