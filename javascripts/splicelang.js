// Syntax Rules
// - binding: (: [name] :)
// - op: (:~ [name] [arg] [arg2] [arg3] [...] {[body]}:)
// - arg: ( binding | 'text )
// - non-arg text: anything else

// Splice.compile :: String="#template"
const Splice = (function() {
  // SPLICE ENGINE - LEXER & PARSER
  // ==============================

  // Abstract Syntax Tree Node Types:
  // - text
  //   - type, value
  // - binding
  //   - type, name, chain, escape
  // - op
  //   - type, name, args[binding||text], body(AST)

  // strTok :: String, String -> String, String
  function strTok(text, endChars, chop=false) {
    let i = 0;
    let j = endChars.length;
    while (j <= text.length) {
      if (text.slice(i, j) == endChars && text.slice(i-1, j) != '\\'+endChars) {
        if (chop) {
          return [text.slice(0, i), text.slice(i+endChars.length)];
        } else {
          return [text.slice(0, i), text.slice(i)];
        }
      }
      i++;
      j++;
    }
    return [text, ''];
  }

  // strTokOr :: String, Array{String} -> String, String
  function strTokOr(text, endChars, chop) {
    return endChars.slice(1).reduce(([token, template], endChr) => {
      let [ tok, temp ] = strTok(text, endChr, chop);
      return Math.min(tok.length, token.length) == tok.length ? [tok, temp] : [token, template];
    }, strTok(text, endChars[0], chop));
  }

  // parse :: String -> Array{Object}
  function parse(template) {
    const ast = [];

    while (template) {
      template = parseToken(template, ast);
    }

    return ast;
  }

  // parseToken :: String, !Array{Object} -> String
  function parseToken(template, ast) {
    let token, match, expr;

    if (match = template.match(/^\(:/)) {

      if (template[2] == '~') {
        [ expr, template ] = parseOperator(template);
        ast.push(expr);
      } else {
        [ expr, template ] = parseBinding(template);
        ast.push(expr);
      }

    } else {
      [ token, template ] = strTok(template, '(:');
      ast.push({type: 'text', value: token});
    }

    return template
  }

  // parseOperator :: String -> Object, String
  function parseOperator(template) {
    let [ token, op ] = template.match(/^\(:~\s*(\w+)/);
    template = template.slice(token.length);

    [ token, template ] = strTok(template, '{');
    let args = token.match(/\S+/g) || [];

    let bodyAST;
    [ bodyAST, template ] = parseBody(template.slice(1));

    args = args.map(function(str) {
      if (str[0] == "'") {
        return {type: 'text', value: str};
      }

      let arr = str.split('.');
      const name = arr[0];
      const chain = arr.slice(1);
      return {type: 'binding', name, chain, escape: true};
    });

    const expr = {
      type: 'op',
      name: op,
      args: args,
      body: bodyAST,
    };

    return [expr, template];
  }

  // parseBody :: String -> Array{Object}, String
  function parseBody(template) {
    let body = '';
    let count = 1;
    while (count != 0) {
      let token;
      [ token, template ] = strTokOr(template, ['(:~', '}:)']);
      if (!template) {
        throw "SPLICE SYNTAX ERROR: Expecting '}:)' to close function body.";
      }

      if (template.slice(0, 3) == '(:~')
        count++;
      else if (template.slice(0, 3) == '}:)')
        count--;
      else
        throw 'BUG'

      if (count == 0) {
        body += token;
      } else {
        body += token + template.slice(0, 3);
      }

      template = template.slice(3);
    }

    return [parse(body), template];
  }

  // parseBinding :: String -> Object, String
  function parseBinding(template) {
    let escape = true;
    if (template[2] == '!') {
      escape = false;
    }

    let token;
    [ token, template ] = strTok(template, ':)', true);
    if (escape) {
      token = token.slice(2);
    } else {
      token = token.slice(3);
    }

    let arr = token.trim().split('.');
    const name = arr[0];
    const chain = arr.slice(1);

    return [{type: 'binding', name, chain, escape }, template];
  }

  // SPLICE ENGINE - GENERATOR
  // =========================

  // evaluateAll :: Array, Object -> String
  function evaluateAll(ast, scope) {
    return ast.reduce(function(html, expr) { return html + evaluate(expr, scope); }, "");
  }

  // evaluate :: Object, Object -> String
  function evaluate(expr, scope) {
    switch (expr.type) {
      case "op":
        return templateFns[expr.name](scope, ...expr.args, expr.body);
      case "binding":
      // oportunity for an uncaught reference error here.
        let value = expr.chain.reduce(function(data, prop) { return data[prop]; }, scope[expr.name]);
        if (typeof value == 'string') {
          return expr.escape ? escapeHTML(value) : value;
        }

        return value;
      case 'text':
        return escapeChars(expr.value);
      default:
        throw "Invalid Node Type in AST";
    }
  }

  // IN-TEMPLATE HELPER FUNCTIONS
  // ============================

  // Namespace for partial templates
  const partials = Object.create(null);

  // Namespace for In-Template Functions
  const templateFns = Object.create(null);

  // if :: Object, Object, Array{Object} -> String
  templateFns.if = function(scope, expr, body) {
    const innerScope = Object.assign({}, scope);
    return evaluate(expr, innerScope) ? evaluateAll(body, innerScope) : '';
  };

  // unless :: Object, Object, Array{Object} -> String
  templateFns.unless = function(scope, expr, body) {
    const innerScope = Object.assign({}, scope);
    return evaluate(expr, innerScope) ? '' : evaluateAll(body, innerScope);
  };

  // each :: Object, Object, Array{Object} -> String
  //      :: Object, Object, Object, Object, Array{Object} -> String
  templateFns.each = function(scope, expr, as, alias, body) {
    if (!body && as) {
      body = as;
      as = null;
      alias = null;
    }

    return evaluate(expr, scope).reduce(function(html, item) {
      const innerScope = Object.assign({}, scope);
      if (alias) {
        innerScope[alias.value.slice(1)] = item
      }

      innerScope.$ = item;
      return html + evaluateAll(body, innerScope);
    }, '');
  };

  // def :: !Object, Object, Object
  templateFns.def = function(scope, alias, expr) {
    switch (expr.type) {
      case 'binding':
        scope[alias.value.slice(1)] = (
        expr.chain.reduce(function(data, prop) { return data[prop]; }, scope[expr.name]));
        break;
      case 'text':
        scope[alias.value.slice(1)] = expr.value.slice(1);
        break;
      default:
        throw new SyntaxError('Unexpected');
    }
    return '';
  };

  // in :: Object, Object -> String
  templateFns.in = function(scope, binding, body) {
    return evaluateAll(body, evaluate(binding, scope));
  };

  // comment :: Object -> String
  templateFns.comment = function(_) { return ''; };

  // partial :: Object, Object -> String
  templateFns.partial = function(scope, expr) {
    return evaluateAll(partials[expr.name], scope);
  }

  // INTERNAL UTILITY FUNCTIONS
  // ==========================

  // escapeHTML :: String -> String
  function escapeHTML(unsafe) {
    return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
 }

  // escapeChars :: String -> String
  function escapeChars(text) {
    let escaped = '';
    let startIdx = 0;
    for (match of text.matchAll(/\\[\S\s]/g)) {
      escaped += text.slice(startIdx, match.index);
      escaped += match[0].slice(1);
      startIdx = match.index + 2;
    }
    return escaped + text.slice(startIdx);
  }

  // replaceNodeWithHtml :: !DOM Node, String
  function replaceNodeWithHTML(node, html) {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = html;
    const newNodes = Array.from(tempContainer.childNodes);
    const parent = node.parentNode;
    let lastNode = newNodes[newNodes.length - 1];
    parent.replaceChild(lastNode, node);
    for (let i = newNodes.length - 2; i >= 0; --i) {
      parent.insertBefore(newNodes[i], lastNode);
      lastNode = newNodes[i];
    }
  }

  // PUBLIC INTERFACE
  // ================
  return {
    // Splice.render :: Object, String="#template", String="#splice-destination"
    render(scope, template_selector, destination_selector) {
      const templateElement = document.querySelector(template_selector);
      const template = templateElement.innerHTML;
      const ast = parse(template);
      const html = evaluateAll(ast, scope);
      document.querySelector(destination_selector).innerHTML = html;
    },

    // Splice.compile :: String -> [Object] -> String
    compile(template) {
      const ast = parse(template);
      return function(scope) { return evaluateAll(ast, scope); };
    },

    // Splice.registerPartial :: String, String
    registerPartial(name, template) {
      if (template) {
        partials[name] = parse(template);
        return;
      }

      const templateElement = document.getElementById(name);
      template = templateElement.innerHTML;
      partials[name] = parse(template);
    },

  };
}());

