// Need to be able to click on chapters and be brought to top of page!!!

class Chapter {
  constructor(name, id, pages) {
    this.name = name;
    this.id = id;
    this.pages = pages;
  }

  static create(el) {
    const name = el.dataset.name;
    let id = formatId(name);
    el.classList.add(id);
    return new Chapter(name, id, sA('.page', el).map(Page.create));
  }
}

class Page {
  constructor(title, id, articles) {
    this.title = title;
    this.id = id;
    this.articles = articles;
  }

  static create(el) {
    const titleEl = s('h1', el);
    const title = titleEl.textContent;
    el.id = formatId(title);
    return new Page(title, el.id, sA('.article', el).map(Article.create));
  }
}

class Article {
  constructor(title, id) {
    this.title = title;
    this.id = id;
  }

  static create(el) {
    const title = s('h2', el).textContent
    el.id = formatId(title);
    return new Article(title, el.id);
  }
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

    sA('.current').forEach(el => {
      el.classList.remove('current');
    });
    const className = event.target.hash.replace('#', '.');
    sA(className).forEach(el => el.classList.add('current'));
    const id = s('a', s('.sidebar' + className)).hash;
    s(id).classList.add('current');
    sA(id.replace('#', '.')).forEach(articleLink => {
      articleLink.classList.add('current');
    });
    window.scroll(0, 0);

  } else if (link.matches('.pageLink')) {

    sA('.page').forEach(el => el.classList.remove('current'));
    sA('.articleLink').forEach(link => link.classList.remove('current'));
    s(link.hash).classList.add('current');
    const pageClass = link.hash.replace('#', '.');
    sA(pageClass).forEach(link => link.classList.add('current'));
    event.preventDefault();
    window.scroll(0, 0);

  } else if (link.matches('.articleLink')) {

    s(link.hash).scrollIntoView(true);

  } else if (link.dataset.pageid) {

    sA('.page').forEach(el => el.classList.remove('current'));
    sA('.articleLink').forEach(link => link.classList.remove('current'));
    s(link.dataset.pageid).classList.add('current');
    sA('.articleLink').filter(a => {
      return [].includes.call(a.classList, link.dataset.pageid.slice(1));
    }).forEach(a => a.classList.add('current'));
    s(link.hash).scrollIntoView(true);

  }
}

// DRIVER SCRIPT
// =============

const chapters = sA('.chapter').reduce((arr, el) =>
  arr.concat(Chapter.create(el)), []);

Splice.registerPartial('sidebar_template');
Splice.render({ chapters });

sA('.language_guide').forEach(el => el.classList.add('current'));
s('#tour_of_splice').classList.add('current');
sA('.tour_of_splice').forEach(articleLink => {
  articleLink.classList.add('current');
});

document.addEventListener('click', clickHandler);

// SYNTAX HIGHLIGHTING
// ===================
setTimeout(() => {
  sA('code.language-splice').forEach(node => {
    let textNode = node.firstChild;
    let html = '<code class="language-splice">' + paint(node.textContent) + '</code>';
    replaceNodeWithHTML(node, html)
  });
}, 0);

// paint :: String -> String
function paint(innerText) {
  const FNAMES = ['each', 'comment', 'def', 'if', 'in', 'partial', 'unless']

  let result = FNAMES.reduce((text, fName) =>
    text.replace(new RegExp(' ' + fName + ' ', 'g'), paintFn(fName)),
  escapeHTML(innerText));

  const KEYWORDS = ['as', '$'];

  result = KEYWORDS.reduce((text, keyword) =>
    text.replace(new RegExp(' \\' + keyword + ' ', 'g'), paintKeyword(keyword)),
  result);

  const atoms = result.match(/&#039;\S+/g);
  if (atoms) {
    result = atoms.reduce((text, atom) => {
      return text.replace(new RegExp(' ' + atom + ' ', 'g'), paintAtom(atom));
    },
    result);
  }

  let tags = result.match(/(?<!&#039;)&lt;\/?[a-z0-9]+&gt;/g)
  if (!tags) return result;

  tags = tags.filter(tag =>
    !(new RegExp('\\(:~' + '[^\\{]*' + tag + '[^\{]*' + '(?=\\{)').test(result))
  );

  result = tags.reduce((text, tag) =>
    text.replace(new RegExp(tag, 'g'), paintTag(tag)),
  result);

  return result;
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

// function paint(node) {
//   if (hasKeywordOrQuote(node)) {
//     let text = node.nodeValue;
//     const keywords = ['each', 'if', 'as', 'end', 'partial'];
//     keywords.forEach(keyword => {
//       let re = new RegExp('\\b'+keyword+'\\b')
//       text = text.replace(re, '<span class="token keyword">' + keyword + '</span>');
//     });
//
//     if (match = node.nodeValue.match(/'\w+/)) {
//       const quote = match[0];
//       text = text.replace(quote, '<span class="token string">' + quote + '</span>');
//     }
//
//     replaceNodeWithHTML(node, text);
//   } else if (node.nodeName == 'SPAN'){
//     if (!hasKeyword(node.firstChild)) {
//       node.classList.remove('keyword');
//     }
//   }

//   Array.from(node.childNodes).forEach(paint);
// }

function hasKeyword(node) {
  if (!node.nodeValue) return;
  const keywords = ['each', 'if', 'as', 'end', 'partial'];
  return keywords.some(keyword => node.nodeValue.includes(keyword));
}

function hasKeywordOrQuote(node) {
  if (!node.nodeValue) return;
  const keywords = ['each', 'if', 'as', 'end', 'partial'];
  return keywords.some(keyword => {
    return node.nodeValue.includes(keyword) || node.nodeValue.match(/'\w+/);
  });
}

// function elt(name, attrs, ...children) {
//   const element = document.createElement(name);
//   Object.keys(attrs).forEach(attr => {
//     element.setAttribute(attr, attrs[attr]);
//   });
//   children.forEach(child => element.appendChild(child));
//   return element;
// }

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
