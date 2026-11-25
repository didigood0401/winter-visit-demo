// A small Russian-language retrieval model for the offline post office.
// Character trigrams let related word forms share features.
const themes = [
  {
    examples: 'дом семья мама папа родители близкие семейный уют тепло бабушка дедушка вместе дети',
    lines: ['Пусть на кухне пахнет мандаринами, а за столом каждый договорит свою самую длинную историю.', 'Желаю вечеров, когда чайник уже вскипел, пирог ещё тёплый и все свои наконец дома.']
  }, {
    examples: 'путешествие отпуск море горы страны приключения дорога поезд самолёт путешествовать',
    lines: ['Желаю билета к морю, попутчика с хорошими историями и хотя бы одного поворота, за которым захочется остаться.', 'Пусть на карте появится город, где вы впервые увидите рассвет и сразу почувствуете себя дома.']
  }, {
    examples: 'работа карьера команда коллеги успех проект бизнес дело мечта творчество вдохновение учёба экзамен',
    lines: ['Пусть для самой смелой задумки найдутся свободное утро, верный союзник и первый удачный набросок.', 'Желаю однажды открыть старый блокнот и с улыбкой отметить: вот эта большая мечта уже сбылась.']
  }, {
    examples: 'покой спокойствие отдых здоровье силы тишина счастье радость чудо волшебство',
    lines: ['Пусть по утрам будут силы на любимые дела, а к вечеру останется время посмотреть, как тихо идёт снег.', 'Желаю чаще ловить тот самый момент, когда за окном метель, а на душе удивительно светло.']
  }
];
function features(text) {
  const result = new Set();
  for (const word of text.toLowerCase().replaceAll('ё', 'е').match(/[а-яa-z]+/g) || []) {
    for (let i = 0; i <= word.length - 3; i++) result.add(word.slice(i, i + 3));
  }
  return result;
}
const documents = themes.map(theme => features(theme.examples));
function localLetter(name, wish) {
  const words = features(wish);
  const scores = documents.map(doc => {
    let score = 0;
    for (const part of words) {
      if (doc.has(part)) score += Math.log(1 + documents.length / documents.filter(d => d.has(part)).length);
    }
    return score / Math.sqrt(doc.size);
  });
  const best = Math.max(...scores);
  const theme = themes[best ? scores.indexOf(best) : 3];
  const previous = el('message').textContent;
  const choices = theme.lines.filter(line => !previous.includes(line));
  return (name ? name + ', с наступающим! ' : 'С наступающим Новым годом! ') + choices[Math.floor(Math.random() * choices.length)];
}
const postcard = el('postcard');
function setOpen(open) {
  const label = open ? 'Закрыть открытку' : 'Открыть открытку';
  postcard.setAttribute('aria-expanded', String(open));
  postcard.setAttribute('aria-label', open ? el('message').textContent + '. ' + label : label);
  el('turn').setAttribute('aria-expanded', String(open));
  el('turn').textContent = label;
  el('letter').setAttribute('aria-hidden', String(!open));
}
function flip() { setOpen(postcard.getAttribute('aria-expanded') !== 'true'); }
postcard.onclick = el('turn').onclick = flip;
let recipient = '', wishText = '';
el('compose').onclick = () => {
  show('Почтальон Снегирь', `<form class="post-form" id="postForm">
    <div class="post-intro"><span class="bullfinch" aria-hidden="true"></span><p>Я прилетел за парой слов. Кому адресовать письмо и чего пожелать в новом году?</p></div>
    <label>Кому открытка<input id="recipient" maxlength="40" placeholder="Например, Аня" autocomplete="off"></label>
    <label>О чём написать<textarea id="wish" maxlength="160" placeholder="О путешествиях, тёплых встречах или давней мечте"></textarea></label>
    <p class="muted" id="postStatus" role="status">Подберу пожелание на вашем устройстве.</p>
    <button class="primary">Вложить поздравление</button></form>`);
  el('recipient').value = recipient;
  el('wish').value = wishText;
  el('postForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button');
    if (submit.disabled) return;
    recipient = el('recipient').value.trim();
    wishText = el('wish').value.trim();
    let letter = localLetter(recipient, wishText);
    const controller = new AbortController();
    const cancel = () => controller.abort();
    panel.addEventListener('close', cancel, { once:true });
    const timer = setTimeout(cancel, 8000);
    let session;
    try {
      submit.disabled = true;
      const model = window.LanguageModel;
      const options = { expectedOutputs:[{type:'text',languages:['ru']}] };
      if (model && await model.availability(options) === 'available' && !controller.signal.aborted) {
        el('postStatus').textContent = 'Снегирь сочиняет письмо…';
        session = await model.create({...options, signal:controller.signal});
        const draft = await session.prompt('Ты почтальон Снегирь. Напиши короткое тёплое поздравление с наступающим Новым годом по-русски. Максимум 32 слова. Без заголовка, подписи и разметки. Адресат и тема письма: ' + JSON.stringify({recipient,wishText}), {signal:controller.signal});
        if (draft.trim() && draft.trim().length <= 300) letter = draft.trim();
      }
    } catch { /* Local retrieval also works offline or when the model is busy. */ }
    finally {
      clearTimeout(timer);
      panel.removeEventListener('close', cancel);
      session?.destroy();
      submit.disabled = false;
    }
    if (!panel.open || !form.isConnected) return;
    el('message').textContent = letter;
    el('letter').querySelector('strong').textContent = 'Вам письмо!';
    panel.close();
    setOpen(true);
    postcard.focus();
  };
};
