'use strict';
/* =============================================================================
   Zizzy — texts in English and Russian. T(key, vars) returns the text in the
   current language ({n} etc. filled from vars). The choice is remembered; the
   first visit follows the browser's language; ?lang=ru or ?lang=en in the
   address (e.g. an embed in a Russian page) sets it for that page. Everything on the canvas is
   upper case and drawn with the 8-px font, which has Latin and Cyrillic
   capitals (Ё is drawn as Е) and the punctuation used here.
   ============================================================================= */
(function (root) {
  const STRINGS = {
    en: {
      'room.0': 'THE DUSTY CELLAR', 'room.1': 'THE BOILER ROOM', 'room.2': 'THE FLOODED TUNNEL', 'room.3': 'THE WORKSHOP', 'room.4': 'THE RADIO ATTIC',
      'item.wrench': 'A RUSTY WRENCH', 'item.oilcan': 'AN OIL CAN', 'item.fuse': 'A GLASS FUSE', 'item.magnet': 'A HORSESHOE MAGNET',
      'sign.deep': 'DEEP', 'sign.stop': 'STOP',
      'hazard.steam': "OUCH! ZIZZY'S GLASS CRACKED IN THE SCALDING STEAM!",
      'hazard.water': 'FIZZ! ZIZZY SHORT-CIRCUITED IN THE WATER!',
      'hazard.arc': "ZAP! THE TESLA COIL BLEW ZIZZY'S FILAMENT!",
      spark: 'A SPARK! ({n}/5)',
      livesLeft: 'LIVES LEFT: {n}',
      gameOver: "GAME OVER\n\nZIZZY'S GLOW HAS GONE OUT. PRESS USE TO TRY AGAIN.",
      handsFull: 'HANDS FULL! DROP SOMETHING FIRST.',
      got: 'GOT {item}', dropped: 'DROPPED {item}', holding: 'HOLDING {item}',
      nothingToPick: 'NOTHING HERE TO PICK UP.', cantDrop: "CAN'T DROP THAT HERE.", nothingToDo: 'NOTHING TO DO HERE.',
      'valve.shut': 'THE VALVE IS SHUT TIGHT.',
      'valve.need': "A BIG STEAM VALVE. THE WHEEL IS STUCK FAST - YOU'LL NEED A TOOL TO TURN IT.",
      'valve.done': 'YOU WEDGE THE WRENCH IN THE WHEEL AND HEAVE... THE STEAM SPLUTTERS AND STOPS!\n\n(THE WRENCH IS STUCK THERE NOW.)',
      'trap.open': 'THE TRAPDOOR IS OPEN.',
      'trap.need': 'A TRAPDOOR! ITS HINGES ARE RUSTED SOLID.',
      'trap.done': 'SQUIRT, SQUIRT... THE HINGES LOOSEN AND THE TRAPDOOR SWINGS OPEN!',
      'trap.ladder': 'A LADDER UP TO A TRAPDOOR IN THE CEILING.',
      boiler: 'THE OLD BOILER STILL GLOWS. IT FEEDS THE STEAM PIPE NEXT DOOR.',
      water: 'DEEP, COLD WATER. ONE DROP AND ZIZZY WOULD SHORT-CIRCUIT! THAT CRATE LOOKS LIKE A RAFT...',
      'robot.fixed': "'BEEP BOOP. THE ATTIC IS THROUGH THAT DOOR. GOOD LUCK, SMALL VALVE!'",
      'robot.need': "'BZZT. I AM SPROCKET. MY FUSE HAS BLOWN AND I CANNOT MOVE. NOBODY PASSES UNTIL I AM FIXED. RULES ARE RULES.'",
      'robot.done': "YOU POP THE FUSE INTO SPROCKET'S BACK...\n\n'SYSTEMS ONLINE! THANK YOU. TAKE THIS MAGNET FROM MY TOOLBOX - IT MAY BE USEFUL.'",
      tesla: 'A TESLA COIL CRACKLES ON AND OFF. WAIT FOR THE GAP!',
      'socket.need': 'AN EMPTY VALVE SOCKET! BUT THE WIRELESS IS STONE COLD. IT NEEDS 5 SPARKS TO WARM UP - YOU HAVE {n}.',
      'grate.empty': 'NOTHING LEFT BEHIND THE GRATE.',
      'grate.need': 'A SPARK IS STUCK BEHIND THE GRATE. THE BARS ARE TOO NARROW FOR ZIZZY.',
      'grate.done': 'YOU DANGLE THE MAGNET THROUGH THE BARS... AND THE SPARK CLINGS TO IT! ({n}/5)',
      wireless: "THE GRAND OLD WIRELESS. THERE'S AN EMPTY SOCKET ON TOP.",
      win: 'ZIZZY HOPS INTO THE SOCKET AND THE FIVE SPARKS LEAP INTO THE GLASS...\n\nTHE GRAND OLD WIRELESS SINGS AGAIN!\n\nTIME {t}',
      intro: 'ZIZZY THE LITTLE VALVE HAS ROLLED OUT OF THE GRAND OLD WIRELESS AND INTO THE CELLAR!\n\nFIND 5 SPARKS AND CLIMB BACK UP TO THE ATTIC TO MAKE THE RADIO SING AGAIN.',
      restartPrompt: 'PRESS R AGAIN TO RESTART.',
      next: 'USE >',
      playAgain: 'PRESS USE TO PLAY AGAIN',
      // page (HTML)
      'html.title': 'Zizzy — an 8-bit adventure',
      'html.tag': 'an 8-bit adventure',
      'html.empty': 'EMPTY', 'html.soundOn': 'SOUND ON', 'html.soundOff': 'SOUND OFF',
      'html.use': 'USE', 'html.pick': 'PICK / DROP',
      'html.up': 'Jump / climb up', 'html.left': 'Left', 'html.down': 'Climb down', 'html.right': 'Right',
      'html.lang': 'Language: English. Switch to Russian (L)',
      'html.inventory': 'Inventory', 'html.controls': 'Touch controls', 'html.screen': 'Zizzy game screen',
      'html.keys': '<b>←/→</b> or <b>A/D</b> walk · <b>↑</b>/<b>W</b> jump (climb on ladders) · <b>↓</b>/<b>S</b> climb down · <b>SPACE</b>/<b>ENTER</b> use · <b>E</b> pick up / drop · <b>TAB</b> or <b>1</b>/<b>2</b> choose hand · <b>M</b> sound · <b>L</b> language · <b>R R</b> restart'
    },
    ru: {
      'room.0': 'ПЫЛЬНЫЙ ПОДВАЛ', 'room.1': 'КОТЕЛЬНАЯ', 'room.2': 'ЗАТОПЛЕННЫЙ ТОННЕЛЬ', 'room.3': 'МАСТЕРСКАЯ', 'room.4': 'РАДИОЧЕРДАК',
      'item.wrench': 'РЖАВЫЙ ГАЕЧНЫЙ КЛЮЧ', 'item.oilcan': 'МАСЛЁНКА', 'item.fuse': 'СТЕКЛЯННЫЙ ПРЕДОХРАНИТЕЛЬ', 'item.magnet': 'МАГНИТ-ПОДКОВА',
      'sign.deep': 'ОМУТ', 'sign.stop': 'СТОП',
      'hazard.steam': 'АЙ! СТЕКЛО ЗИЗЗИ ТРЕСНУЛО ОТ ОБЖИГАЮЩЕГО ПАРА!',
      'hazard.water': 'ПШШ! ЗИЗЗИ ЗАКОРОТИЛО В ВОДЕ!',
      'hazard.arc': 'ТРЕСЬ! КАТУШКА ТЕСЛЫ СПАЛИЛА НИТЬ НАКАЛА ЗИЗЗИ!',
      spark: 'ИСКРА! ({n}/5)',
      livesLeft: 'ОСТАЛОСЬ ЖИЗНЕЙ: {n}',
      gameOver: 'ИГРА ОКОНЧЕНА\n\nСВЕЧЕНИЕ ЗИЗЗИ ПОГАСЛО. НАЖМИ «ДЕЙСТВИЕ», ЧТОБЫ ПОПРОБОВАТЬ СНОВА.',
      handsFull: 'РУКИ ЗАНЯТЫ! СНАЧАЛА ЧТО-НИБУДЬ ПОЛОЖИ.',
      got: 'ВЗЯТО: {item}', dropped: 'ОСТАВЛЕНО: {item}', holding: 'В РУКЕ: {item}',
      nothingToPick: 'ЗДЕСЬ НЕЧЕГО ВЗЯТЬ.', cantDrop: 'ЗДЕСЬ ЭТО НЕ ПОЛОЖИТЬ.', nothingToDo: 'ЗДЕСЬ НЕЧЕГО ДЕЛАТЬ.',
      'valve.shut': 'ВЕНТИЛЬ НАКРЕПКО ЗАКРЫТ.',
      'valve.need': 'БОЛЬШОЙ ПАРОВОЙ ВЕНТИЛЬ. МАХОВИК НАМЕРТВО ЗАКИС - НУЖЕН ИНСТРУМЕНТ, ЧТОБЫ ЕГО ПОВЕРНУТЬ.',
      'valve.done': 'ТЫ ВСТАВЛЯЕШЬ КЛЮЧ В МАХОВИК И НАЛЕГАЕШЬ... ПАР ФЫРКАЕТ И СТИХАЕТ!\n\n(КЛЮЧ ТАК И ЗАСТРЯЛ В МАХОВИКЕ.)',
      'trap.open': 'ЛЮК ОТКРЫТ.',
      'trap.need': 'ЛЮК! ЕГО ПЕТЛИ НАМЕРТВО ПРОРЖАВЕЛИ.',
      'trap.done': 'ПШИК, ПШИК... ПЕТЛИ ПОДДАЮТСЯ, И ЛЮК РАСПАХИВАЕТСЯ!',
      'trap.ladder': 'ЛЕСТНИЦА ВЕДЁТ К ЛЮКУ В ПОТОЛКЕ.',
      boiler: 'СТАРЫЙ КОТЁЛ ЕЩЁ ТЛЕЕТ. ОН ПИТАЕТ ПАРОВУЮ ТРУБУ ПО СОСЕДСТВУ.',
      water: 'ГЛУБОКАЯ ХОЛОДНАЯ ВОДА. ОДНА КАПЛЯ - И ЗИЗЗИ ЗАКОРОТИТ! А ТОТ ЯЩИК ПОХОЖ НА ПЛОТ...',
      'robot.fixed': '«БИП-БУП. ЧЕРДАК ЗА ТОЙ ДВЕРЬЮ. УДАЧИ, МАЛЕНЬКАЯ ЛАМПА!»',
      'robot.need': '«БЗЗТ. Я СПРОКЕТ. МОЙ ПРЕДОХРАНИТЕЛЬ СГОРЕЛ, И Я НЕ МОГУ ДВИГАТЬСЯ. НИКТО НЕ ПРОЙДЁТ, ПОКА МЕНЯ НЕ ПОЧИНЯТ. ПРАВИЛА ЕСТЬ ПРАВИЛА.»',
      'robot.done': 'ТЫ ВСТАВЛЯЕШЬ ПРЕДОХРАНИТЕЛЬ В СПИНУ СПРОКЕТА...\n\n«СИСТЕМЫ В НОРМЕ! СПАСИБО. ВОЗЬМИ ЭТОТ МАГНИТ ИЗ МОЕГО ЯЩИКА С ИНСТРУМЕНТАМИ - ОН МОЖЕТ ПРИГОДИТЬСЯ.»',
      tesla: 'КАТУШКА ТЕСЛЫ ТО ТРЕЩИТ, ТО ЗАТИХАЕТ. ДОЖДИСЬ ПАУЗЫ!',
      'socket.need': 'ПУСТАЯ ЛАМПОВАЯ ПАНЕЛЬКА! НО РАДИОЛА СОВСЕМ ОСТЫЛА. ЧТОБЫ ЕЁ ОЖИВИТЬ, НУЖНО 5 ИСКР - У ТЕБЯ {n}.',
      'grate.empty': 'ЗА РЕШЁТКОЙ БОЛЬШЕ НИЧЕГО НЕТ.',
      'grate.need': 'ЗА РЕШЁТКОЙ ЗАСТРЯЛА ИСКРА. ПРУТЬЯ СЛИШКОМ ЧАСТЫЕ ДЛЯ ЗИЗЗИ.',
      'grate.done': 'ТЫ ПРОСОВЫВАЕШЬ МАГНИТ МЕЖДУ ПРУТЬЯМИ... И ИСКРА ПРИЛИПАЕТ К НЕМУ! ({n}/5)',
      wireless: 'СТАРАЯ ДОБРАЯ РАДИОЛА. СВЕРХУ - ПУСТАЯ ПАНЕЛЬКА.',
      win: 'ЗИЗЗИ ЗАПРЫГИВАЕТ В ПАНЕЛЬКУ, И ПЯТЬ ИСКР ВЛЕТАЮТ В СТЕКЛО...\n\nСТАРАЯ РАДИОЛА СНОВА ПОЁТ!\n\nВРЕМЯ {t}',
      intro: 'МАЛЕНЬКАЯ РАДИОЛАМПА ЗИЗЗИ ВЫКАТИЛАСЬ ИЗ СТАРОЙ РАДИОЛЫ ПРЯМО В ПОДВАЛ!\n\nНАЙДИ 5 ИСКР И ВЕРНИСЬ НА ЧЕРДАК, ЧТОБЫ РАДИОЛА СНОВА ЗАПЕЛА.',
      restartPrompt: 'НАЖМИ R ЕЩЁ РАЗ, ЧТОБЫ НАЧАТЬ ЗАНОВО.',
      next: 'ДАЛЕЕ >',
      playAgain: 'ДЕЙСТВИЕ - ИГРАТЬ СНОВА',
      'html.title': 'Зиззи — 8-битное приключение',
      'html.tag': '8-битное приключение',
      'html.empty': 'ПУСТО', 'html.soundOn': 'ЗВУК ВКЛ', 'html.soundOff': 'ЗВУК ВЫКЛ',
      'html.use': 'ДЕЙСТВИЕ', 'html.pick': 'ВЗЯТЬ / ПОЛОЖИТЬ',
      'html.up': 'Прыжок / вверх по лестнице', 'html.left': 'Влево', 'html.down': 'Вниз по лестнице', 'html.right': 'Вправо',
      'html.lang': 'Язык: русский. Переключить на английский (L)',
      'html.inventory': 'Инвентарь', 'html.controls': 'Сенсорное управление', 'html.screen': 'Экран игры Зиззи',
      'html.keys': '<b>←/→</b> или <b>A/D</b> — идти · <b>↑</b>/<b>W</b> — прыжок (по лестнице вверх) · <b>↓</b>/<b>S</b> — вниз по лестнице · <b>ПРОБЕЛ</b>/<b>ENTER</b> — действие · <b>E</b> — взять / положить · <b>TAB</b> или <b>1</b>/<b>2</b> — выбрать руку · <b>M</b> — звук · <b>L</b> — язык · <b>R R</b> — заново'
    }
  };
  const LANGS = Object.keys(STRINGS);

  let lang = 'en';
  try { lang = localStorage.getItem('zizzy-lang') || ''; } catch (e) { lang = ''; }
  if (!LANGS.includes(lang)) lang = typeof navigator !== 'undefined' && /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
  try { const q = new URLSearchParams(location.search).get('lang'); if (LANGS.includes(q)) lang = q; } catch (e) { /* no location (tests) */ }

  const listeners = [];
  function T(key, vars) {
    let s = STRINGS[lang][key];
    if (s === undefined) s = STRINGS.en[key];
    if (s === undefined) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s;
  }
  function setLang(l) {
    if (!LANGS.includes(l) || l === lang) return;
    lang = l;
    try { localStorage.setItem('zizzy-lang', l); } catch (e) { /* storage blocked */ }
    listeners.forEach(f => f(l));
  }
  root.ZIZZY_I18N = {
    STRINGS, LANGS, T, setLang,
    get lang() { return lang; },
    toggle() { setLang(lang === 'en' ? 'ru' : 'en'); },
    onChange(f) { listeners.push(f); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
