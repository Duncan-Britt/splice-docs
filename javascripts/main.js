function Chapter(name, id, pages) {
  this.name = name;
  this.id = id;
  this.pages = pages;
}

Chapter.create = function(el) {
  const name = el.dataset.name;
  let id = formatId(name);
  el.classList.add(id);
  return new Chapter(name, id, sA('.page', el).map(Page.create));
}

function Page(title, id, articles) {
  this.title = title;
  this.id = id;
  this.articles = articles;
}

Page.create = function(el) {
  const titleEl = s('h1', el);
  const title = titleEl.textContent;
  el.id = formatId(title);
  return new Page(title, el.id, sA('.article', el).map(Article.create));
}

function Article(title, id) {
  this.title = title;
  this.id = id;
}

Article.create = function(el) {
  const title = s('h2', el).textContent
  el.id = formatId(title);
  return new Article(title, el.id);
}

// formatId :: String -> String
function formatId(title) {
  return title.toLowerCase().split(/\s/).join('_').replace(/\W/g, '');
}

// s :: String, DOM Node -> Element Node
function s(selector, node=document) {
  return node.querySelector(selector);
}

// s :: String, DOM Node -> Array{Element Node}
function sA(selector, node=document) {
  return Array.from(node.querySelectorAll(selector));
}

// clickHandler :: Object
function clickHandler(event) {
  const link = event.target;

  if (!link.matches('a')) return;
  if (link.matches('a[rel]')) return;

  if (link.matches('.headerLink')) {

    sA('.current').forEach(function(el) {
      el.classList.remove('current');
    });
    const className = event.target.hash.replace('#', '.');

    sA(className).forEach(function(el) { el.classList.add('current') });
    const id = s('a', s('.sidebar' + className)).hash;
    s(id).classList.add('current');
    sA(id.replace('#', '.')).forEach(function(articleLink) {
      articleLink.classList.add('current');
    });
    window.scroll(0, 0);

  } else if (link.matches('.pageLink')) {

    sA('.page').forEach(function(el) { el.classList.remove('current') });
    sA('.articleLink').forEach(function(link) { link.classList.remove('current') });
    s(link.hash).classList.add('current');
    const pageClass = link.hash.replace('#', '.');
    sA(pageClass).forEach(function(link) { link.classList.add('current') });
    event.preventDefault();
    window.scroll(0, 0);

  } else if (link.matches('.articleLink')) {

    s(link.hash).scrollIntoView(true);

  } else if (link.dataset.pageid) {

    sA('.page').forEach(function(el) { el.classList.remove('current') });
    sA('.articleLink').forEach(function(link) { link.classList.remove('current') });
    s(link.dataset.pageid).classList.add('current');
    sA('.articleLink').filter(function(a) {
      return [].includes.call(a.classList, link.dataset.pageid.slice(1));
    }).forEach(function(a) { a.classList.add('current') });
    s(link.hash).scrollIntoView(true);

  }
}

// DRIVER SCRIPT
// =============

const chapters = sA('.chapter').reduce(function(arr, el) {
  return arr.concat(Chapter.create(el))
}, []);

Splice.registerPartial('sidebar_template');
Splice.render({ chapters });

sA('.language_guide').forEach(function (el) { el.classList.add('current') });
s('#tour_of_splice').classList.add('current');
sA('.tour_of_splice').forEach(function(articleLink) {
  articleLink.classList.add('current');
});

document.addEventListener('click', clickHandler);

// SYNTAX HIGHLIGHTING
// ===================

setTimeout(function() {
  sA('code.language-splice').forEach(function(node) {
    let textNode = node.firstChild;
    let html = '<code class="language-splice">' + paint(node.textContent) + '</code>';
    replaceNodeWithHTML(node, html)
  });
}, 0);

// paint :: String -> String
function paint(innerText) {
  const FNAMES = ['each', 'comment', 'def', 'if', 'in', 'partial', 'unless']

  let result = FNAMES.reduce(function(text, fName) {
    return text.replace(new RegExp(' ' + fName + ' ', 'g'), paintFn(fName));
  }, escapeHTML(innerText));

  const KEYWORDS = ['as', '$'];

  result = KEYWORDS.reduce(function(text, keyword) {
    return text.replace(new RegExp(' \\' + keyword + ' ', 'g'), paintKeyword(keyword));
  }, result);

  const atoms = result.match(/&#039;\S+/g);
  if (atoms) {
    result = atoms.reduce(function(text, atom) {
      return text.replace(new RegExp(' ' + atom + ' ', 'g'), paintAtom(atom));
    }, result);
  }

  let tags = getTags(result);
  if (!tags) return result;

  return tags.reduce(function(text, tag) {
    return text.replace(new RegExp(tag, 'g'), paintTag(tag));
  }, result);
}

const ESCAPE_QUOTE = '&#039;';

function getTags(text) {
  const tags = [];

  let tagData;
  while(tagData = text.match(/&lt;\/?[a-z0-9]+&gt;/)) {
    let tag = tagData[0];

    if (text.slice(tagData.index - 6, tagData.index) == ESCAPE_QUOTE) {
      text = text.slice(tagData.index)
      text = text.slice(text.match(/\s/).index);
    } else {
      tags.push(tag);
      text = text.slice(tag.length + tagData.index);
    }
  }

  return tags;
}

function paintTag(tag) {
  const [_, open, tagName, close] = tag.match(/(&lt;\/?)([a-z0-9]+)(&gt;)/);
  return open + '<span style="color:#fd645f;">' + tagName + '</span>' + close;
}

function paintKeyword(keyword) {
  return ' <span style="color:#fd9546;">' + keyword + '</span> ';
}

function paintAtom(atom) {
  return ' <span style="color:#96ccff;">' + atom + '</span> ';
}

  // paintFn :: String -> String
function paintFn(fName) {
  return ' <span style="color:#c792ff;">' + fName + '</span> ';
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

function hasKeyword(node) {
  if (!node.nodeValue) return;

  const keywords = ['each', 'if', 'as', 'end', 'partial'];
  return keywords.some(function(keyword) { node.nodeValue.includes(keyword) });
}

function hasKeywordOrQuote(node) {
  if (!node.nodeValue) return;
  const keywords = ['each', 'if', 'as', 'end', 'partial'];
  return keywords.some(function(keyword) {
    return node.nodeValue.includes(keyword) || node.nodeValue.match(/'\w+/);
  });
}

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
