(() => {
  const artWidth = 1888;
  const artHeight = 1334;
  const cafe = $('cafeView');
  const stage = $('cafeStage');
  const frame = $('cafeFrame');
  const rig = $('cafeRig');
  const leaf = $('cafeLeaf');
  const ring = $('cafeRing');
  const room = cafe.querySelector('.cafe-room');
  const viewToggle = $('menuViewToggle');
  const zoomOut = $('cafeZoomOut');
  const detail = $('cafeDetail');
  const action = $('cafeItemAction');
  const plate = $('cafePlate');
  const addPlate = $('cafeAddPlate');
  const guide = $('cafeGuide');
  const status = $('cafeStatus');
  const targets = { food: $('cafeFoodTargets'), drinks: $('cafeDrinksTargets') };
  let reading = null;
  let preview = null;
  let hoverTimer;
  let returnTimer;
  let turning = false;

  function placeOnPaper(element, [x, y, width, height]) {
    element.style.left = `${x / artWidth * 100}%`;
    element.style.top = `${y / artHeight * 100}%`;
    element.style.width = `${width / artWidth * 100}%`;
    element.style.height = `${height / artHeight * 100}%`;
  }

  function clearTimers() {
    clearTimeout(hoverTimer);
    clearTimeout(returnTimer);
  }

  function drawCamera() {
    const item = reading || preview;
    stage.dataset.zoom = reading ? 'reading' : preview ? 'preview' : 'overview';
    ring.hidden = !preview || Boolean(reading);

    if (!item) {
      rig.style.transform = '';
      room.style.transform = '';
      return;
    }

    const [x, y, width, height] = item.box;
    const paperWidth = frame.clientWidth;
    const paperHeight = frame.clientHeight;
    const dx = ((x + width / 2) / artWidth - 0.5) * paperWidth;
    const dy = ((y + height / 2) / artHeight - 0.5) * paperHeight;
    const targetWidth = width / artWidth * paperWidth;
    const targetHeight = height / artHeight * paperHeight;

    if (reading) {
      const widthBudget = Math.min(stage.clientWidth * (stage.clientWidth < 650 ? 0.76 : 0.56), 540);
      const heightBudget = stage.clientHeight * 0.59;
      const zoom = Math.max(1.3, Math.min(widthBudget / targetWidth, heightBudget / targetHeight, 8));
      const raise = frame.offsetTop - stage.clientHeight * 0.42;
      rig.style.transform = `translate3d(${-dx * zoom}px, ${-dy * zoom - raise}px, 0) scale(${zoom})`;
      room.style.transform = '';
      return;
    }

    placeOnPaper(ring, item.box);
    const tiltX = dy / paperHeight * 17;
    const tiltY = -dx / paperWidth * 22;
    rig.style.transform = `translate3d(${-dx * 0.12}px, ${-dy * 0.12}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.13)`;
    room.style.transform = `translate3d(${tiltY * 0.65}px, ${tiltX * -0.55}px, 0) scale(1.025)`;
  }

  function fitPaper() {
    if (cafe.hidden) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const compact = width < 650;
    const sideFit = compact ? width - 34 : width * 0.71;
    const paperWidth = Math.min(sideFit, (height - 146) * artWidth / artHeight, 1170);
    frame.style.width = `${paperWidth}px`;
    const paperHeight = paperWidth * artHeight / artWidth;
    frame.style.top = compact ? `${Math.min(height - paperHeight / 2 - 48, height - paperWidth * 0.48)}px` : '';
    drawCamera();
  }

  function syncTargets() {
    for (const targetLayer of Object.values(targets)) {
      targetLayer.inert = Boolean(reading) || turning;
    }
  }

  function syncPlate() {
    for (const item of printedMenu.food) {
      if (!item.plateKind) continue;
      const picked = item.control.getAttribute('aria-pressed') === 'true';
      item.mark.hidden = !picked;
      item.target.setAttribute('aria-label', `${item.label}${picked ? ', selected for your plate' : ''}`);
    }

    const flatAdd = $('addPlate');
    plate.hidden = showingDrinks || (selection.protein === null && !selection.side.length && selection.sauce === null);
    $('cafePlateProgress').textContent = $('progress').textContent;
    addPlate.disabled = flatAdd.disabled;
    addPlate.textContent = flatAdd.textContent;
    if (reading?.plateKind) updateAction(reading);
  }

  function updateAction(item) {
    action.hidden = !item.control;
    if (!item.control) return;
    if (item.plateKind) {
      const picked = item.control.getAttribute('aria-pressed') === 'true';
      action.textContent = picked ? 'Remove from plate' : `Choose ${item.plateKind}`;
    } else {
      action.textContent = item.customizable ? 'Choose options' : 'Add to order';
    }
  }

  function hold(item) {
    if (turning || reading) return;
    clearTimers();
    reading = item;
    preview = null;
    syncTargets();
    guide.hidden = true;
    zoomOut.hidden = false;
    detail.hidden = false;
    $('cafeItemName').textContent = item.name;
    $('cafeItemPrice').textContent = item.price ? money(item.price) : '';
    $('cafeItemDescription').textContent = item.description || '';
    updateAction(item);
    drawCamera();
    status.textContent = `Reading ${item.name}${item.price ? ', ' + money(item.price) : ''}`;
    (action.hidden ? zoomOut : action).focus({ preventScroll: true });
  }

  function fullMenu(restoreFocus = false) {
    clearTimers();
    const previous = reading;
    reading = null;
    preview = null;
    syncTargets();
    guide.hidden = false;
    detail.hidden = true;
    zoomOut.hidden = true;
    drawCamera();
    if (restoreFocus && previous) {
      previous.target.focus({ preventScroll: true });
      status.textContent = 'Full menu';
    }
  }

  for (const [side, items] of Object.entries(printedMenu)) {
    for (const item of items) {
      const target = document.createElement('button');
      target.type = 'button';
      target.className = 'cafe-target';
      item.label = `Read ${item.name}${item.price ? ' ' + money(item.price) : ''}`;
      target.setAttribute('aria-label', item.label);
      placeOnPaper(target, item.box);
      targets[side].append(target);
      item.target = target;

      if (item.plateKind) {
        const mark = document.createElement('span');
        mark.className = 'cafe-picked';
        mark.hidden = true;
        placeOnPaper(mark, item.box);
        $('cafeSelections').append(mark);
        item.mark = mark;
      }

      // The hit layer stays at the overview coordinates while the paper moves.
      target.addEventListener('pointerenter', event => {
        if (reading || turning || reducedMenuMotion.matches || event.pointerType !== 'mouse') return;
        clearTimers();
        hoverTimer = setTimeout(() => {
          preview = item;
          drawCamera();
        }, 155);
      });
      target.addEventListener('pointerleave', () => {
        clearTimers();
        if (reading || turning) return;
        returnTimer = setTimeout(() => {
          preview = null;
          drawCamera();
        }, 85);
      });
      target.addEventListener('click', () => hold(item));
    }
  }

  action.addEventListener('click', () => {
    if (!reading?.control) return;
    const item = reading;
    const before = item.control.getAttribute('aria-pressed');
    item.control.click();
    if (item.plateKind && item.control.getAttribute('aria-pressed') !== before) fullMenu(true);
  });
  addPlate.addEventListener('click', () => {
    $('addPlate').click();
    if (plate.hidden) $('reviewTop').focus({ preventScroll: true });
  });
  zoomOut.addEventListener('click', () => fullMenu(true));
  document.addEventListener('era:platechange', syncPlate);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !reading || cafe.hidden || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    fullMenu(true);
  });

  function showSide(drinks) {
    $('cafeFoodArt').hidden = drinks;
    $('cafeDrinksArt').hidden = !drinks;
    $('cafeSelections').hidden = drinks;
    targets.food.hidden = drinks;
    targets.drinks.hidden = !drinks;
    syncPlate();
  }

  async function flip(change) {
    turning = true;
    fullMenu();
    let turnOut;
    try {
      if (reducedMenuMotion.matches || !leaf.animate) {
        change();
        return;
      }

      const direction = showingDrinks ? 1 : -1;
      const distance = frame.clientWidth * 0.44;
      const handTiming = { duration: 590, easing: 'ease-in-out' };
      $('cafeLeftHand').animate([
        { transform: 'none' },
        { transform: `translateX(${distance}px) translateY(11px) rotate(-9deg)`, offset: 0.46 },
        { transform: 'none' }
      ], handTiming);
      $('cafeRightHand').animate([
        { transform: 'none' },
        { transform: `translateX(${-distance}px) translateY(24px) rotate(12deg)`, offset: 0.46 },
        { transform: 'none' }
      ], handTiming);
      turnOut = leaf.animate([
        { transform: 'rotateY(0)' },
        { transform: `rotateY(${direction * 89}deg)` }
      ], { duration: 275, easing: 'ease-in', fill: 'forwards' });
      await turnOut.finished;
      change();
      turnOut.cancel();
      await leaf.animate([
        { transform: `rotateY(${-direction * 89}deg)` },
        { transform: 'rotateY(0)' }
      ], { duration: 315, easing: 'ease-out' }).finished;
    } finally {
      turnOut?.cancel();
      turning = false;
      syncTargets();
    }
  }

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  function updateGuide() {
    guide.textContent = finePointer.matches && !reducedMenuMotion.matches
      ? 'Hover to lean in · Click to hold'
      : 'Tap an item to read it up close';
  }
  finePointer.addEventListener('change', updateGuide);
  reducedMenuMotion.addEventListener('change', () => {
    clearTimers();
    preview = null;
    drawCamera();
    updateGuide();
  });

  function showCafe(active) {
    fullMenu();
    cafe.hidden = !active;
    $('menuFaces').hidden = active;
    document.documentElement.dataset.menuView = active ? 'cafe' : 'flat';
    viewToggle.textContent = active ? 'Flat menu' : 'Café view';
    showSide(showingDrinks);
    fitPaper();
    window.scrollTo(0, 0);
  }

  cafeMenu = { get active() { return !cafe.hidden; }, showSide, flip };
  viewToggle.hidden = false;
  viewToggle.addEventListener('click', () => {
    if (!flipBusy) showCafe(cafe.hidden);
  });
  $('logo').addEventListener('click', () => {
    if (!cafe.hidden && !turning) fullMenu();
  });
  new ResizeObserver(fitPaper).observe(stage);
  updateGuide();
  showCafe(matchMedia('(min-width: 760px)').matches);
})();
