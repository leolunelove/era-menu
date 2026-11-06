(() => {
  if (orderMode) return;

  const sections = {
    food: [
      { name: 'Create your plate', box: [37, 93, 880, 1090], anchor: 'plateTitle' },
      { name: 'Starters & sharers', box: [982, 103, 865, 695], anchor: 'starterTitle' },
      { name: 'Something sweet', box: [1049, 826, 758, 317], anchor: 'sweetTitle' },
      { name: 'Extras', box: [25, 1206, 1748, 121], anchor: 'menuExtras' }
    ],
    drinks: [
      { name: 'H2O bar', box: [22, 97, 375, 1082], anchor: 'waterPanel' },
      { name: 'Smoothies', box: [526, 95, 568, 478], anchor: 'smoothiePanel' },
      { name: 'Matcha', box: [462, 626, 711, 552], anchor: 'matchaPanel' },
      { name: 'Coffee', box: [1220, 96, 317, 621], anchor: 'coffeePanel' },
      { name: 'Tea', box: [1560, 96, 295, 269], anchor: 'teaPanel' },
      { name: 'Soft drinks & kombucha', box: [1227, 760, 643, 420], anchor: 'softPanel' }
    ]
  };
  const table = $('tableView');
  const stage = $('tableStage');
  const hits = $('tablePaperHits');
  const rail = $('readerIndex');
  const toggle = $('readerViewToggle');
  const back = $('readerBack');
  const detail = $('readerDetail');
  const hint = $('tableHint');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let scene;
  let loading;
  let section = null;
  let item = null;
  let hoverTimer;
  let returnTimer;
  let busy = false;
  let cameraTask = 0;
  let targets = [];

  const sideKey = () => showingDrinks ? 'drinks' : 'food';

  function clearHover() {
    clearTimeout(hoverTimer);
    clearTimeout(returnTimer);
  }

  function updateHint() {
    if (!scene) {
      hint.textContent = 'Opening the menu…';
    } else if (section) {
      hint.textContent = 'Select an item to read it up close';
    } else if (finePointer.matches && !reducedMenuMotion.matches) {
      hint.textContent = 'Hover to peek · Click to read';
    } else {
      hint.textContent = 'Select an item to read it up close';
    }
  }

  function markSection() {
    for (const button of rail.children) {
      button.setAttribute('aria-pressed', String(button.textContent === section?.group.name));
    }
  }

  function describe() {
    const subject = item?.entry || section?.group;
    detail.hidden = !subject;
    back.hidden = !subject;
    hint.hidden = Boolean(item);
    if (subject) {
      $('readerName').textContent = subject.name;
      $('readerPrice').textContent = subject.price ? money(subject.price) : '';
      $('readerDescription').textContent = subject.description || '';
      back.textContent = item && section ? `← ${section.group.name}` : '← Full menu';
    }
    stage.dataset.reading = item ? 'item' : section ? 'section' : 'whole';
    updateHint();
    markSection();
  }

  function insideSection([x, y, width, height]) {
    if (!section) return true;
    const [left, top, spanX, spanY] = section.group.box;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    return centerX >= left && centerX <= left + spanX && centerY >= top && centerY <= top + spanY;
  }

  function positionTargets() {
    hits.inert = !scene || table.hidden || Boolean(item) || busy;
    if (hits.inert) return;
    for (const target of targets) {
      const { button, entry } = target;
      const points = scene.projectBox(entry.box, Boolean(section));
      const left = Math.min(...points.map(point => point[0]));
      const top = Math.min(...points.map(point => point[1]));
      const right = Math.max(...points.map(point => point[0]));
      const bottom = Math.max(...points.map(point => point[1]));
      button.hidden = !insideSection(entry.box) || right <= 0 || bottom <= 0 || left >= stage.clientWidth || top >= stage.clientHeight;
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
      button.style.width = `${right - left}px`;
      button.style.height = `${bottom - top}px`;
      button.style.clipPath = `polygon(${points.map(([x, y]) => `${x - left}px ${y - top}px`).join(', ')})`;
    }
  }

  async function moveReader(mode, box, restoreFocus) {
    const task = ++cameraTask;
    clearHover();
    busy = true;
    hits.inert = true;
    describe();
    if (mode === 'item') back.focus({ preventScroll: true });
    await scene.focus(mode, box);
    if (task !== cameraTask) return;
    busy = false;
    positionTargets();
    if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  }

  function showSection(group, trigger) {
    if (table.hidden) {
      $(group.anchor).scrollIntoView({ block: 'start', behavior: reducedMenuMotion.matches ? 'instant' : 'smooth' });
      return;
    }
    if (!scene || flipBusy) return;
    section = { group, trigger };
    item = null;
    void moveReader('section', group.box);
  }

  function showItem(target) {
    if (!scene || busy || flipBusy || item) return;
    item = target;
    void moveReader('item', target.entry.box);
    $('faceStatus').textContent = `Reading ${target.entry.name}${target.entry.price ? ', ' + money(target.entry.price) : ''}`;
  }

  function backOneLevel() {
    if (!scene || flipBusy) return;
    const previousItem = item;
    const previousSection = section;
    item = null;
    if (previousItem && previousSection) {
      void moveReader('section', previousSection.group.box, previousItem.button);
      return;
    }
    section = null;
    void moveReader('whole', null, previousItem?.button || previousSection?.trigger);
  }

  function makeTargets() {
    targets = printedMenu[sideKey()].map(entry => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-item';
      button.setAttribute('aria-label', `Read ${entry.name}${entry.price ? ' ' + money(entry.price) : ''}`);
      const target = { entry, button };
      button.addEventListener('pointerenter', event => {
        if (!scene || busy || item || section || reducedMenuMotion.matches || event.pointerType !== 'mouse') return;
        clearHover();
        hoverTimer = setTimeout(() => { void scene.focus('peek', entry.box); }, 150);
      });
      button.addEventListener('pointerleave', () => {
        clearHover();
        if (!scene || busy || item || section) return;
        returnTimer = setTimeout(() => { void scene.focus('whole'); }, 80);
      });
      button.addEventListener('click', () => showItem(target));
      return target;
    });
    hits.replaceChildren(...targets.map(({ button }) => button));
  }

  function refreshSide() {
    clearHover();
    section = null;
    item = null;
    $('tablePreview').src = menuArt[sideKey()];
    rail.replaceChildren(...sections[sideKey()].map(group => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = group.name;
      button.addEventListener('click', () => showSection(group, button));
      return button;
    }));
    makeTargets();
    if (scene && !table.hidden) void scene.setSide(showingDrinks);
    describe();
    positionTargets();
  }

  function showFlat() {
    cameraTask += 1;
    clearHover();
    busy = false;
    item = null;
    section = null;
    scene?.cancelMotion();
    table.hidden = true;
    $('menuFaces').hidden = false;
    $('readerSecondary').hidden = false;
    document.documentElement.dataset.readerView = 'flat';
    toggle.textContent = '3D view';
    markSection();
    window.scrollTo(0, 0);
  }

  function unavailable() {
    showFlat();
    toggle.hidden = true;
    $('faceStatus').textContent = '3D view unavailable. Showing the flat menu.';
  }

  async function showTable() {
    if (flipBusy) return;
    table.hidden = false;
    $('menuFaces').hidden = true;
    $('readerSecondary').hidden = true;
    document.documentElement.dataset.readerView = 'table';
    toggle.textContent = 'Flat menu';
    window.scrollTo(0, 0);
    updateHint();
    try {
      loading ||= import('./table-scene.js?v=20261106-3').then(({ createTableScene }) => createTableScene({
        mount: $('tableCanvas'), images: menuArt, motion: reducedMenuMotion, contextLost: unavailable
      }));
      scene = await loading;
      if (table.hidden) return;
      $('tablePlaceholder').hidden = true;
      stage.dataset.rendered = '3d';
      scene.resize(stage.clientWidth, stage.clientHeight);
      refreshSide();
    } catch {
      unavailable();
    }
  }

  menuReader = {
    get active() { return Boolean(scene) && !table.hidden; },
    async turn(drinks) {
      cameraTask += 1;
      clearHover();
      busy = true;
      section = null;
      item = null;
      hits.inert = true;
      describe();
      try {
        await scene.turn(drinks);
      } finally {
        busy = false;
      }
    }
  };

  toggle.hidden = false;
  rail.hidden = false;
  toggle.addEventListener('click', () => {
    if (flipBusy) return;
    if (table.hidden) void showTable();
    else showFlat();
  });
  back.addEventListener('click', backOneLevel);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !table.hidden && (item || section)) {
      event.preventDefault();
      backOneLevel();
    }
  });
  document.addEventListener('era:sidechange', refreshSide);
  finePointer.addEventListener('change', updateHint);
  reducedMenuMotion.addEventListener('change', updateHint);
  new ResizeObserver(() => {
    if (!scene || table.hidden) return;
    scene.resize(stage.clientWidth, stage.clientHeight);
    positionTargets();
  }).observe(stage);

  refreshSide();
  if (matchMedia('(min-width: 760px)').matches) void showTable();
  else showFlat();
})();
