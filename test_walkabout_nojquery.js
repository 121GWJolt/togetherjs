jshint("walkabout.js", {evil: true});
// => Script passed: .../walkabout.js

function getElement(id) {
  var el = document.getElementById(id);
  if (! el) {
    throw 'Element not found: #' + id;
  }
  return el;
}

function text(t) {
  return document.createTextNode(t);
}

function log(t) {
  console.log(t);
  if (window.print) {
    print(t);
  }
  getElement("log").appendChild(text(t + "\n"));
}

function logger(name) {
  return function (text) {
    log(name + ": " + text);
  };
}

Walkabout.addEventListener(getElement("button"), "click", function () {
  log("button click");
});

Walkabout.addEventListener(getElement("textinput"), "keypress", function (event) {
  console.log("got keypress", event.charCode, event.keyCode);
  if (event.keyCode == 13) {
    var value = Walkabout.value(getElement("textinput"));
    log("Entered text: " + value);
    getElement("textinput").value = "";
  }
});

location.hash = "";

Walkabout.addEventListener(window, "hashchange", function () {
  var hash = location.hash;
  if (! hash) {
    return;
  }
  log("Hash changed: " + hash);
  hash = parseInt(hash.substr(1), 10);
  getElement("link").href = "#" + (hash + 1);
});

Walkabout.addEventListener(getElement("fixture"), "click", function (event) {
  if (event.target.classList.contains("item")) {
    log("Clicked li: " + event.target.textContent);
  }
}, false, {selector: ".item"});

// =>

var actions = Walkabout.findActions(document);
print(actions);

/* =>

[
  {element: <a href="#1" id="link">link</a>},
  {
    event: {
      element: <li class="item">an item 1</li>,
      handler: function ...,
      type: "click"
    }
  },
  {
    event: {
      element: <li class="item">an item 2</li>,
      handler: function ...,
      type: "click"
    }
  },
  {
    event: {
      element: <button id="button">A button</button>,
      handler: function ...,
      type: "click"
    }
  },
  {
    event: {
      element: <input data-walkabout-keypress="{which: 13}" id="textinput" type="text" />,
      handler: function ...,
      type: "keypress"
    }
  }
]

*/

Walkabout.random.setSeed(100);

actions.forEach(function (a) {
  a.run();
});
wait();

// I don't understand why "Hash change: #1" happens twice
/* =>

Clicked li: an item 1
Clicked li: an item 2
button click
Entered text: EzsmOGsiee
Hash changed: #1
Hash changed: #1
*/

getElement("textinput").setAttribute("data-mock-options", "['a', 'b']");
print(Walkabout.findActions(getElement("textinput"))[0]);
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();

// FIXME: for some reason this isn't the same as in the jquery example
// it generates a different order
/* =>

{
  event: {
    element: <input data-mock-options="['a', 'b']" data-walkabout-keypress="{which: 13}" id="textinput" type="text" />,
    handler: function ...,
    type: "keypress"
  }
}
Entered text: a
Entered text: a
Entered text: a
Entered text: a
Entered text: b
Entered text: b

*/

print(Walkabout.rewriteListeners("function foobar() {el.addEventListener('click', function (foo) {}, false);}"));

/* =>
function foobar() {Walkabout.addEventListener(el, 'click', function (foo) {}, false);}
*/

print(Walkabout.rewriteListeners("$('#test')[0].addEventListener('click', function (foo) {}, false);"));

/* =>
Walkabout.addEventListener($('#test')[0], 'click', function (foo) {}, false);
*/

print(Walkabout.rewriteListeners("foo().bar.value"));

/* =>
Walkabout.value(foo().bar)
*/
