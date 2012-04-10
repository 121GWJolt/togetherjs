var Slowparse = (function() {
  function ParseError(parseInfo) {
    this.name = "ParseError";
    this.message = parseInfo.type;
    this.parseInfo = parseInfo;
  }
  
  ParseError.prototype = Error.prototype;

  function Stream(text) {
    this.tokens = [];
    this.text = text;
    this.pos = 0;
    this.tokenStart = 0;
  }
  
  Stream.prototype = {
    peek: function() {
      return this.text[this.pos];
    },
    next: function() {
      if (!this.end())
        return this.text[this.pos++];
    },
    end: function() {
      return (this.pos == this.text.length);
    },
    eat: function(matcher) {
      if (this.peek().match(matcher))
        return this.next();
    },
    eatWhile: function(matcher) {
      while (!this.end()) {
        if (!this.eat(matcher))
          return;
      }
    },
    pushToken: function(style) {
      if (this.pos == this.tokenStart)
        return;
      this.tokens.push({
        style: style,
        position: this.tokenStart,
        string: this.text.slice(this.tokenStart, this.pos)
      });
      this.tokenStart = this.pos;
    }
  };
  
  function Tokenizer(html) {
    var stream = new Stream(html);
    var modes = {
      text: function() {
        while (!stream.end()) {
          if (stream.peek() == '<') {
            stream.pushToken(null);
            modes.startTag();
          } else
            stream.next();
        }

        stream.pushToken(null);
      },
      startTag: function() {
        if (stream.next() != '<')
          throw new Error('assertion failed, expected to be on "<"');

        stream.eatWhile(/[A-Za-z\/]/);
        stream.pushToken('tag');

        if (!stream.end())
          modes.endTag();
      },
      endTag: function() {
        stream.eatWhile(/[^>]/);
        stream.next();
        stream.pushToken('tag');
      }
    };
    
    modes.text();
    
    return (function() {
      var pos = 0;
      var tokens = stream.tokens.slice().reverse();

      return {
        position: function() {
          return pos;
        },
        next: function() {
          if (tokens.length == 0)
            return null;
          var token = tokens.pop();
          pos += token.string.length;
          return token;
        }
      };
    })();
  }
  
  function CodeMirrorTokenizer(html) {
    var htmlMode = CodeMirror.getMode({
      indentUnit: 2
    }, "htmlmixed");
    var state = htmlMode.startState();
    var lines = html.split('\n').reverse();
    var pos = 0;
    var linePos = 0;
    var currentLine;
    var stream;

    function advanceLine() {
      currentLine = lines.pop();
      stream = new CodeMirror.StringStream(currentLine);
    }
    
    advanceLine();
    
    return {
      position: function() {
        return pos + linePos;
      },
      nextNonWhitespace: function() {
        while (1) {
          var token = this.next();
          if (token === null || token.string.trim().length)
            return token;
        }
      },
      next: function() {
        while (stream.eol()) {
          pos += currentLine.length;
          linePos = 0;
          if (lines.length == 0)
            return null;
          advanceLine();
          return {
            string: '\n',
            style: null,
            position: pos++
          };
        }
        var styleName = htmlMode.token(stream, state);
        var token = {
          string: currentLine.slice(linePos, stream.pos),
          style: styleName,
          position: pos + linePos
        };
        linePos = stream.pos;
        return token;
      }
    };
  }
  
  var Slowparse = {
    Tokenizer: Tokenizer,
    CodeMirrorTokenizer: CodeMirrorTokenizer,
    HTML: function(document, html) {
      var fragment = document.createDocumentFragment();
      var error = null;
      var tokenizer = CodeMirrorTokenizer(html);
      var currentNode = fragment;
      
      function parseOpenTag(tokenizer) {
        while (1) {
          var token = tokenizer.next();
          if (token) {
            if (token.style == "tag" && token.string == ">") {
              currentNode.parseInfo.openTag.end = token.position + 1;
              return;
            } else if (token.style == "attribute") {
              // TODO: make sure this is a valid attribute name, or a
              // DOM exception will be thrown.
              var attr = document.createAttribute(token.string);
              attr.parseInfo = {
                name: {
                  start: token.position,
                  end: token.position + token.string.length
                }
              };
              // TODO: Verify this next token is an '='.
              tokenizer.nextNonWhitespace();
              // TODO: Verify this next token is an attribute value.
              token = tokenizer.nextNonWhitespace();
              attr.parseInfo.value = {
                start: token.position,
                end: token.position + token.string.length
              };
              attr.nodeValue = token.string.slice(1, -1);
              currentNode.attributes.setNamedItem(attr);
            }
          } else {
            throw new Error("TODO: Report an unclosed tag error");
          }
        }
      }
      
      function parseText(tokenizer) {
        while (1) {
          var token = tokenizer.next();
          if (token) {
            if (token.style == "tag") {
              if (token.string.slice(0, 2) == "</") {
                // TODO: Verify this token is a matching close tag.
                // TODO: Verify this next token is an endTag.
                tokenizer.nextNonWhitespace();
                currentNode.parseInfo.closeTag = {
                  start: token.position,
                  end: tokenizer.position() + 1
                };
                currentNode = currentNode.parentNode;
              } else {
                var tagName = token.string.slice(1);
                if (!(tagName && tagName.match(/^[A-Za-z]+$/)))
                  throw new ParseError({
                    type: "INVALID_TAG_NAME",
                    value: tagName,
                    position: token.position + 1
                  });
                var element = document.createElement(tagName);
                currentNode.appendChild(element);
                currentNode = element;
                currentNode.parseInfo = {
                  openTag: {
                    start: token.position,
                    end: undefined
                  }
                };
                parseOpenTag(tokenizer);
              }
            } else if (token.style == null) {
              var textNode = document.createTextNode(token.string);
              currentNode.appendChild(textNode);
              textNode.parseInfo = {
                start: token.position,
                end: token.position + token.string.length
              };
            } else {
              throw new Error("unexpected token: " + JSON.stringify(token));
            }
          } else {
            if (currentNode !== fragment) {
              throw new ParseError({
                type: "UNCLOSED_TAG",
                node: currentNode,
                position: tokenizer.position()
              });
            }
            return;
          }
        }
      }

      try {
        parseText(tokenizer);
      } catch (e) {
        if (e.parseInfo) {
          error = e.parseInfo;
        } else
          throw e;
      }
      
      return {
        document: fragment,
        error: error
      };
    }
  };
  
  return Slowparse;
})();
