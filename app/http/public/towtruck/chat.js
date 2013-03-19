/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["require", "jquery", "util", "session", "ui", "templates", "playback"], function (require, $, util, session, ui, templates, playback) {
  var chat = util.Module("chat");
  var assert = util.assert;

  session.hub.on("chat", function (msg) {
    ui.addChat({
      type: "text",
      clientId: msg.clientId,
      text: msg.text,
      messageId: msg.messageId
    });
    if (! session.isClient) {
      chat.Chat.addChat({
        type: "text",
        text: msg.text,
        clientId: msg.clientId,
        date: Date.now(),
        messageId: msg.messageId
      });
    }
  });

  session.hub.on("bye", function (msg) {
    ui.addChat({
      type: "left-session",
      clientId: msg.clientId
    });
  });

  session.hub.on("hello", function () {
    if (! session.isClient) {
      var log = chat.Chat.loadChat();
      if (log.length) {
        session.send({
          type: "chat-catchup",
          log: log
        });
      }
    }
  });

  session.hub.on("chat-catchup", function (msg) {
    assert(session.isClient, "Master received chat-catchup", session.isClient);
    if (ui.isChatEmpty()) {
      ui.addChat({type: "clear"});
      for (var i=0; i<msg.log.length; i++) {
        var l = msg.log[i];
        ui.addChat({
          type: "text",
          text: l.text,
          date: l.date,
          clientId: l.clientId,
          messageId: l.messageId,
          catchup: true
        });
      }
    }
  });

  // The number of milliseconds after which to put a break in the conversation
  // (if messages come faster than this, they will be kind of combined)
  var MESSAGE_BREAK_TIME = 20000;

  session.peers.on("add update", function (peer) {
    ui.updatePerson(peer.clientId);
  });

  chat.Chat = {
    submit: function (message) {
      var parts = message.split(/ /);
      if (parts[0].charAt(0) == "/") {
        var name = parts[0].substr(1).toLowerCase();
        var method = this["command_" + name];
        if (method) {
          method.call(this, parts[1]);
        }
        return;
      }
      var msg = {
        type: "text",
        text: message,
        clientId: session.clientId,
        messageId: session.clientId + "-" + Date.now(),
        date: Date.now()
      };
      session.send({
        type: "chat",
        text: message,
        messageId: msg.messageId
      });
      ui.addChat(msg);
      if (! session.isClient) {
        this.addChat(msg);
      }
    },

    command_help: function () {
      var msg = util.trim(templates.help);
      ui.addChat({
        type: "system",
        text: msg
      });
    },

    command_test: function (args) {
      // FIXME: I don't think this really works?  Need some deferred call
      var Walkabout = require("walkabout");
      args = util.trim(args || "").split(/\s+/g);
      if (args[0] === "" || ! args.length) {
        if (this._testCancel) {
          args = ["cancel"];
        } else {
          args = ["start"];
        }
      }
      if (args[0] == "cancel") {
        ui.addChat({
          type: "system",
          text: "Aborting test"
        });
        this._testCancel();
        this._testCancel = null;
        return;
      }
      if (args[0] == "start") {
        var times = parseInt(args[1], 10);
        if (isNaN(times) || ! times) {
          times = 100;
        }
        ui.addChat({
          type: "system",
          text: "Testing with walkabout.js"
        });
        var tmpl = $(templates.walkabout);
        var container = ui.container.find(".towtruck-test-container");
        container.empty();
        container.append(tmpl);
        container.show();
        var statusContainer = container.find(".towtruck-status");
        statusContainer.text("starting...");
        this._testCancel = Walkabout.runManyActions({
          ondone: function () {
            statusContainer.text("done");
            statusContainer.one("click", function () {
              container.hide();
            });
            this._testCancel = null;
          },
          onstatus: function (status) {
            var note = "actions: " + status.actions.length + " running: " +
              (status.times - status.remaining) + " / " + status.times;
            statusContainer.text(note);
          }
        });
        return;
      }
      if (args[0] == "show") {
        if (this._testShow.length) {
          this._testShow.forEach(function (item) {
            if (item) {
              item.remove();
            }
          }, this);
          this._testShow = [];
        } else {
          var actions = Walkabout.findActions();
          actions.forEach(function (action) {
            this._testShow.push(action.show());
          }, this);
        }
        return;
      }
      if (args[0] == "describe") {
        Walkabout.findActions().forEach(function (action) {
          ui.addChat({
            type: "system",
            text: action.description()
          });
        }, this);
        return;
      }
      ui.addChat({
        type: "system",
        text: "Did not understand: " + args.join(" ")
      });
    },

    _testCancel: null,
    _testShow: [],

    command_clear: function () {
      ui.addChat({
        type: "clear"
      });
      this.clearHistory();
    },

    command_exec: function () {
      var expr = Array.prototype.slice.call(arguments).join(" ");
      var result;
      var e = eval;
      try {
        result = eval(expr);
      } catch (e) {
        ui.addChat({
          type: "system",
          text: "Error: " + e
        });
      }
      if (result !== undefined) {
        ui.addChat({
          type: "system",
          text: "" + result
        });
      }
    },

    command_stickyshare: function (id) {
      id = id || null;
      session.settings.set("stickyShare", id);
      if (id) {
        ui.addChat({
          type: "system",
          text: "Set shareId to " + id + " (restart to use)"
        });
      } else {
        ui.addChat({
          type: "system",
          text: "Removed sticky shareId"
        });
      }
    },

    command_record: function () {
      ui.addChat({
        type: "system",
        text: "When you see the robot appear, the recording will have started"
      });
      window.open(
        session.recordUrl(), "_blank",
        "left,width=" + ($(window).width() / 2));
    },

    playing: null,

    command_playback: function (url) {
      if (this.playing) {
        this.playing.cancel();
        this.playing.unload();
        this.playing = null;
        ui.addChat({
          type: "system",
          text: "playback cancelled"
        });
        return;
      }
      if (! url) {
        ui.addChat({
          type: "system",
          text: "Nothing is playing"
        });
        return;
      }
      var logLoader = playback.getLogs(url);
      logLoader.then(
        (function (logs) {
          logs.save();
          this.playing = logs;
          logs.play();
        }).bind(this),
        function (error) {
          ui.addChat({
            type: "system",
            text: "Error fetching " + url + ":\n" + JSON.stringify(error, null, "  ")
          });
        });
      // FIXME: I shouldn't be doing this directly here, I should
      // call some ui.* function:
      $("#towtruck-chat").hide();
    },

    storageKey: "towtruck.chatlog",
    messageExpireTime: 1000 * 60 * 60 * 6, // 6 hours in milliseconds
    maxLogMessages: 100,

    addChat: function (obj) {
      assert(! session.isClient);
      var log = this.loadChat();
      log.push(obj);
      // Cull old entries:
      var earlies = -1;
      var now = Date.now();
      for (var i=0; i<log.length; i++) {
        if (now - log[i].date < this.messageExpireTime) {
          break;
        }
        earlies = i;
      }
      if (earlies > -1) {
        log.splice(0, earlies + 1);
      }
      if (log.length > this.maxLogMessages) {
        log.splice(0, log.length - this.maxLogMessages);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(log));
    },

    loadChat: function () {
      var log = localStorage.getItem(this.storageKey);
      if (! log) {
        log = [];
      } else {
        log = JSON.parse(log);
      }
      return log;
    },

    clearHistory: function () {
      localStorage.removeItem(this.storageKey);
    }

  };

  session.on("ui-ready", function () {
    if (session.isClient) {
      // If we're a client, the master will send the messages
      return;
    }
    if (! ui.isChatEmpty()) {
      return;
    }
    var log = chat.Chat.loadChat();
    for (var i=0; i<log.length; i++) {
      var l = log[i];
      // FIXME: duplicated from chat-catchup
      ui.addChat({
        type: "text",
        text: l.text,
        date: l.date,
        clientId: l.clientId,
        messageId: l.messageId,
        catchup: true
      });
    }
    // Re-load a partial playback:
    var logs = playback.getRunningLogs();
    if (logs) {
      chat.Chat.playing = logs;
      logs.play();
    }
  });

  return chat;

});
