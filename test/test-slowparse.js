module("Slowparse");

// Get the innerHTML of a document fragment.
function documentFragmentHTML(doc) {
  var div = document.createElement("div");
  for (var i = 0; i < doc.childNodes.length; i++) {
    div.appendChild(doc.childNodes[i].cloneNode(true));
  }
  return div.innerHTML;
}

function assertParseInfo(html, node, name, map) {
  function getDottedProperty(obj, property) {
    var parts = property.split('.');
    parts.forEach(function(part) {
      if (!(part in obj))
        return null;
      obj = obj[part];
    });
    return obj;
  }

  for (var dottedName in map) {
    var baseName = name + "." + dottedName;
    var interval = getDottedProperty(node, dottedName);
    ok(interval, baseName + " exists");
    if (interval) {
      equal(html.slice(interval.start, interval.end), map[dottedName],
            baseName + " start/end positions are correct");
    }
  }
}

test("parsing of valid HTML", function() {
  var html = '<p class="foo">hello there</p>';
  var result = Slowparse.HTML(document, html);
  
  ok(result.document, "document is returned");
  equal(result.error, null, "no errors are reported");
  
  var doc = result.document;
  
  equal(doc.childNodes.length, 1, "document has one child");
  
  var p = doc.childNodes[0];

  equal(p.nodeName, "P", "first child of generated DOM is <p>");
  assertParseInfo(html, p, "p", {
    'parseInfo.openTag': '<p class="foo">',
    'parseInfo.closeTag': '</p>'
  });
  equal(p.childNodes.length, 1, "<p> has one child");
  equal(p.attributes.length, 1, "<p> has one attribute");

  var textNode = p.childNodes[0];

  equal(textNode.nodeType, textNode.TEXT_NODE, "<p>'s child is a text node.");
  assertParseInfo(html, textNode, "textNode", {
    'parseInfo': 'hello there',
  });
  assertParseInfo(html, p.attributes[0], "attr", {
    'parseInfo.name': 'class',
    'parseInfo.value': '"foo"'
  });

  equal(documentFragmentHTML(doc), html,
        "serialization of generated DOM matches original HTML");
});

[
  '<p>hello\nthere</p>',
  '<p>\n  hello there</p>'
].forEach(function(html) {
  test("parsing of text content w/ newlines: " + 
       JSON.stringify(html), function() {
    var result = Slowparse.HTML(document, html);
  
    ok(result.document, "document is returned");
    equal(result.error, null, "no errors are reported");

    equal(documentFragmentHTML(result.document),
          html);
  });
});

[
  '<p class = "foo">hello there</p><p>u</p>',
  '<p class="foo"  >hello there</p><p>u</p>',
  '<p \nclass="foo">hello there</p><p>u</p>',
  '<p class="foo">hello there</p ><p>u</p>'
].forEach(function(html) {
  test("parsing of valid HTML w/ whitespace: " +
       JSON.stringify(html), function() {
    var canonicalHTML = '<p class="foo">hello there</p><p>u</p>';
    var result = Slowparse.HTML(document, html);

    ok(result.document, "document is returned");
    equal(result.error, null, "no errors are reported");

    var p = result.document.childNodes[0];
    assertParseInfo(html, p.childNodes[0], "textNode", {
      'parseInfo': 'hello there'
    });
    assertParseInfo(html, p.attributes[0], "attr", {
      'parseInfo.name': 'class',
      'parseInfo.value': '"foo"'
    });

    equal(documentFragmentHTML(result.document), canonicalHTML,
          "Document fragment is correct.");
  });
});

test("parse error: UNCLOSED_TAG", function() {
  var html = '<p class="foo">hello there';
  var error = Slowparse.HTML(document, html).error;

  equal(error.type, "UNCLOSED_TAG", "parser dies b/c of unclosed tag");
  assertParseInfo(html, error, "error", {
    'openTag': '<p class="foo">'
  });
});

test("parse error: INVALID_TAG_NAME", function() {
  var html = '< p>hello there</p>';
  var error = Slowparse.HTML(document, html).error;
  
  equal(error.type, "INVALID_TAG_NAME", "parser dies b/c of invalid tag");
  assertParseInfo(html, error, "error", {
    'openTag': '<'
  });
});

test("parse error: MISMATCHED_CLOSE_TAG", function() {
  var html = '<p>hello there</i>';
  var error = Slowparse.HTML(document, html).error;
  
  equal(error.type, "MISMATCHED_CLOSE_TAG");
  equal(error.openTagName, 'p');
  equal(error.closeTagName, 'i');
  assertParseInfo(html, error, "error", {
    'openTag': '<p>',
    'closeTag': '</i'
  });
});
