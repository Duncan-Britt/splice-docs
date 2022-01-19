// Syntax Rules
// - binding: (: [name] :)
// - op: (:~ [name] [arg] [arg2] [arg3] [...] {[body]}:)
// - arg: ( binding | 'text )
// - non-arg text: anything else

// Splice.compile :: String="#template"
const Splice = (function() {
  // SPLICE ENGINE - PARSER
  // ======================

  // Abstract Syntax Tree Node Types:
  // - text
  //   - type, value
  // - binding
  //   - type, name, chain, escape
  // - arg
  //   - type, name
  // - op
  //   - type, name, args[], body(AST)

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
        [ token, expr ] = parseFunction(template);
        ast.push(expr);
      } else {
        [ token, expr ] = parseBinding(template);
        ast.push(expr);
      }

    } else {
      token = textChunk(template)
      ast.push({type: 'text', value: token});
    }

    return template.slice(token.length);
  }

  function textChunk(template) {
    const match = template.match(/^[\S\s]+?(?<!\\)\(:/);
    if (!match) return template;

    if (match[0].match(/(?<!\\)\(:/)) {
      return match[0].slice(0, -2);
    } else {
      return match[0] + textChunk(template.slice(match[0].length));
    }
  }

  // parseFunction :: String -> Array{String, Object}
  function parseFunction(template) {
    let tokens = '';

    let [ token, op ] = template.match(/^\(:~\s*(\w+)/);
    tokens += token;
    template = template.slice(token.length);

    [ token ] = template.match(/[\S\s]+?(?<!\\){/);
    let args = token.slice(0, -1).match(/\S+/g) || [];
    tokens += token;
    template = template.slice(token.length);

    [ token, bodyAST ] = parseBody(template);
    tokens += token;

    args = args.map(str => {
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

    return [tokens, expr];
  }

  // parseBody :: String -> Array{String, Array{Object}}
  function parseBody(template) {
    let resultToken = '';
    let body = '';
    let count = 1;
    while (count != 0) {
      let token;
      try {
        [ token ] = template.match(/[\S\s]*?(?<!\\)((?<!\\)\((?<!\\):|(?<!\\):(?<!\\)\))/);
      } catch (error) {
        throw "SPLICE SYNTAX ERROR: Expecting '}:)' to close function body.";
      }

      if (template[token.length] == '~') {
        count++;
      } else if (token.match(/(?<!\\)\}(?<!\\):(?<!\\)\)/)) {
        count--;
      }

      if (count == 0) {
        body = resultToken + token.match(/([\S\s])*(?=(?<!\\)\})/)[0];
      }
      resultToken += token;
      template = template.slice(token.length);
    }

    return [resultToken, parse(body)];
  }

  // parseBinding :: String -> Array{String, Object}
  function parseBinding(template) {
    let escape = true;
    if (template[2] == '!') {
      escape = false;
    }

    let chunk;
    if (escape) {
      chunk = template
        .match(/(?<!\\)\((?<!\\):[\S\s]*?(?=(?<!\\):(?<!\\)\))/)[0]
    } else {
      chunk = template
        .match(/(?<!\\)\((?<!\\):(?<!\\)![\S\s]*?(?=(?<!\\):(?<!\\)\))/)[0]
    }

    let testChunk = escape ? chunk.slice(2) : chunk.slice(3);

    testChunk.split('').forEach(chr => {
      if (!chr.match(/[ \w\.\$]/)) {
        throw `SPLICE SYNTAX ERROR: Unexpected char ${chr} in (:${testChunk}:) `;
      }
    });

    let token, str;
    if (escape) {
      [ token, str ] = template.match(/(?<!\\)\((?<!\\):\s*([\w\.\$]+)\s*(?<!\\):(?<!\\)\)/);
    } else {
      [ token, str ] = template.match(/(?<!\\)\((?<!\\):(?<!\\)!\s*([\w\.\$]+)\s*(?<!\\):(?<!\\)\)/);
    }

    let arr = str.split('.');
    const name = arr[0];
    const chain = arr.slice(1);
    return [token, {type: 'binding', name, chain, escape }];
  }

  // SPLICE ENGINE - EVALUATOR
  // =========================

  // evaluateAll :: Array, Object -> String
  function evaluateAll(ast, scope) {
    return ast.reduce((html, expr) => html + evaluate(expr, scope), "");
  }

  // evaluate :: Object, Object -> String
  function evaluate(expr, scope) {
    switch (expr.type) {
      case "op":
        return templateFns[expr.name](scope, ...expr.args, expr.body);
      case "binding":
        let value = expr.chain.reduce((data, prop) => data[prop], scope[expr.name]);
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

  // IN-TEMPLATE HELPER FUNCTIONS
  // ============================

  // Namespace for partial templates
  const partials = Object.create(null);

  // Namespace for In-Template Functions
  const templateFns = Object.create(null);

  // if :: Object, Object, Array{Object} -> String
  templateFns.if = (scope, expr, body) => {
    const innerScope = Object.assign({}, scope);
    return evaluate(expr, innerScope) ? evaluateAll(body, innerScope) : '';
  };

  // unless :: Object, Object, Array{Object} -> String
  templateFns.unless = (scope, expr, body) => {
    const innerScope = Object.assign({}, scope);
    return evaluate(expr, innerScope) ? '' : evaluateAll(body, innerScope);
  };

  // each :: Object, Object, Array{Object} -> String
  //      :: Object, Object, Object, Object, Array{Object} -> String
  templateFns.each = (scope, expr, as, alias, body) => {
    if (!body && as) {
      body = as;
      as = null;
      alias = null;
    }

    return evaluate(expr, scope).reduce((html, item) => {
      const innerScope = Object.assign({}, scope);
      if (alias) {
        innerScope[alias.value.slice(1)] = item
      }

      innerScope.$ = item;
      return html + evaluateAll(body, innerScope);
    }, '');
  };

  // def :: !Object, Object, Object
  templateFns.def = (scope, alias, expr) => {
    switch (expr.type) {
      case 'binding':
        scope[alias.value.slice(1)] = (
        expr.chain.reduce((data, prop) => data[prop], scope[expr.name]));
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
  templateFns.in = (scope, binding, body) => {
    return evaluateAll(body, evaluate(binding, scope));
  };

  // comment :: Object -> String
  templateFns.comment = (_) => '';

  // partial :: Object, Object -> String
  templateFns.partial = (scope, expr) => {
    return evaluateAll(partials[expr.name], scope);
  }

  // INTERNAL UTILITY FUNCTIONS
  // ==========================

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
    // Splice.render :: Object, String="#template"
    render(scope, selector="#template") {
      const templateElement = document.querySelector(selector);
      const template = templateElement.innerHTML;
      const ast = parse(template);
      const html = evaluateAll(ast, scope);
      replaceNodeWithHTML(templateElement, html);
    },

    // Splice.compile :: String -> [Object] -> String
    compile(template) {
      const ast = parse(template);
      return scope => evaluateAll(ast, scope);
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
