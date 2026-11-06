// Source artwork is displayed unchanged; transparent buttons supply interactions.
function drinkArt(box,label){const a=art(box,label);a.querySelector('img').src='drinks.png';return a}
function panel(id, box, label, items = []) {
  const element = $(id);
  element.classList.add('drink-panel');
  element.append(drinkArt(box, label));
  for (const [name, price, rect, kind] of items) {
    const button = document.createElement('button');
    button.className = 'drink-hit';
    button.setAttribute('aria-label', name + ' ' + money(price));
    button.title = name + ' · ' + money(price);
    button.style.left = (rect[0] - box[0]) / box[2] * 100 + '%';
    button.style.top = (rect[1] - box[1]) / box[3] * 100 + '%';
    button.style.width = rect[2] / box[2] * 100 + '%';
    button.style.height = rect[3] / box[3] * 100 + '%';
    button.onclick = () => kind ? customizeDrink(name, price, kind) : add(name, price);
    element.append(button);
    printedMenu.drinks.push({ name, price, box: rect, customizable: Boolean(kind), control: button });
  }
}
panel('waterPanel',[0,77,420,1120],'H2O bar. £3.50. One glass, unlimited refills. Kiwi & cucumber, strawberry & lemonade, mango & passion fruit, watermelon & mint. Ultra-filtered water also available at the bar.',[
['Kiwi & cucumber',3.5,[26,345,164,290]],['Strawberry & lemonade',3.5,[227,345,167,290]],['Mango & passion fruit',3.5,[25,670,171,288]],['Watermelon & mint',3.5,[226,670,168,288]]]);
panel('smoothiePanel',[420,77,786,536],'Smoothies. Full-size & freshly made. Only real ingredients.',[
['Deep focus smoothie',9.9,[529,214,172,356]],['Elevate smoothie',9.9,[721,214,169,356]]]);
panel('matchaPanel',[420,613,786,584],'Matcha. Full-size & freshly made. Ceremonial grade matcha.',[
['Iced matcha latte',4.5,[456,765,173,412],'matcha'],['Mango matcha',5.5,[634,765,156,412],'matcha'],['Strawberry matcha',5.5,[804,765,151,412],'matcha'],['Watermelon yuzu matcha spritz',5.5,[958,752,204,420]]]);
panel('coffeePanel',[1206,77,336,663],'Coffee. Double shot as standard. Decaf and iced options available.',[
['Espresso',1.9,[1228,187,88,145],'coffee'],['Macchiato',2.4,[1325,187,97,145],'coffee'],['Cortado',2.4,[1430,187,97,145],'coffee'],['Americano',2.4,[1228,345,88,141],'coffee'],['Flat white',2.9,[1325,345,97,141],'coffee'],['Cappuccino',2.9,[1430,345,97,141],'coffee'],['Latte',2.9,[1228,502,88,140],'coffee'],['Matcha latte',2.9,[1325,502,97,140],'matcha'],['Mocha',3.4,[1430,502,97,140],'coffee']]);
panel('teaPanel',[1542,77,346,663],'Tea. A selection of leafs. English breakfast: short, bold & rich. Green tea: light, fresh & delicate. Peppermint: fresh & caffeine-free.',[
['English breakfast tea',2.5,[1567,190,281,54]],['Green tea',2.5,[1567,245,281,54]],['Peppermint tea',2.5,[1567,300,281,56]]]);
panel('softPanel',[1206,740,682,230],'Soft drinks. A range of soft drinks available. Ask our team.');
panel('kombuchaPanel',[1206,970,682,227],'Kombucha. A rotating & curated selection. Ask our team.');
panel('milkPanel',[0,1197,1888,137],'Make it custom. Choose your milk. Dairy included; oat, almond or coconut +50p. Caramel or vanilla syrup +95p each. Order at the counter or scan the QR code on your table.');
const gluten=document.createElement('p');gluten.className='drinks-gluten';gluten.textContent='ALL DRINK SELECTION IS GLUTEN FREE';$('drinksFace').prepend(gluten);
printedMenu.drinks.push(
  { name: 'Ultra-filtered water', box: [27, 999, 365, 173], description: 'Cold, sparkling or room temperature. Available from the bar.' },
  { name: 'Soft drinks', box: [1230, 764, 635, 192], description: 'Ask our team for the selection.' },
  { name: 'Kombucha', box: [1230, 981, 635, 191], description: 'Ask our team for the rotating selection.' }
);

let showingDrinks = false;
let flipBusy = false;
let cafeMenu = null;
const reducedMenuMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setMenuSide(drinks) {
  showingDrinks = drinks;
  $('foodFace').hidden = drinks;
  $('drinksFace').hidden = !drinks;
  $('flipMenu').querySelector('span').textContent = drinks ? 'Food' : 'Drinks';
  $('flipMenu').setAttribute('aria-label', 'Flip menu to ' + (drinks ? 'food' : 'drinks'));
  $('faceStatus').textContent = (drinks ? 'Drinks' : 'Food') + ' side of the menu';
  cafeMenu?.showSide(drinks);
  if (!cafeMenu?.active) window.scrollTo(0, 0);
}

$('flipMenu').onclick = async () => {
  if (flipBusy) return;
  flipBusy = true;
  const button = $('flipMenu');
  button.setAttribute('aria-busy', 'true');
  const next = !showingDrinks;
  const change = () => setMenuSide(next);
  try {
    if (cafeMenu?.active) {
      await cafeMenu.flip(change);
    } else if (reducedMenuMotion.matches || !$('menuFaces').animate) {
      change();
    } else {
      const faces = $('menuFaces');
      const turn = faces.animate([
        { transform: 'perspective(1800px) rotateY(0)', opacity: 1 },
        { transform: 'perspective(1800px) rotateY(-85deg)', opacity: 0 }
      ], { duration: 170, easing: 'ease-in', fill: 'forwards' });
      await turn.finished;
      change();
      turn.cancel();
      await faces.animate([
        { transform: 'perspective(1800px) rotateY(85deg)', opacity: 0 },
        { transform: 'perspective(1800px) rotateY(0)', opacity: 1 }
      ], { duration: 200, easing: 'ease-out' }).finished;
    }
  } catch {
    if (showingDrinks !== next) change();
  } finally {
    flipBusy = false;
    button.removeAttribute('aria-busy');
  }
};
function customizeDrink(name,base,kind){
 const d=document.createElement('dialog');d.className='drink-options';
 const hasMilk=!['Espresso','Americano'].includes(name);
 d.innerHTML=`<form method="dialog"><div class="dialogHead"><h2>${name}</h2><button value="cancel" aria-label="Cancel">×</button></div>${hasMilk?'<label for="drinkMilk">Milk</label><select id="drinkMilk"><option value="Dairy">Dairy · included</option><option value="Oat">Oat · +£0.50</option><option value="Almond">Almond · +£0.50</option><option value="Coconut">Coconut · +£0.50</option></select>':''}<fieldset><legend>Syrup · +£0.95 each</legend><label><input type="checkbox" name="syrup" value="Caramel"> Caramel</label><label><input type="checkbox" name="syrup" value="Vanilla"> Vanilla</label></fieldset>${kind==='coffee'?'<fieldset><legend>Options</legend><label><input type="checkbox" id="decaf"> Decaf</label><label><input type="checkbox" id="iced"> Iced</label></fieldset>':''}<button class="confirmDip" value="add">Add to order · ${money(base)}</button></form>`;
 document.body.append(d);d.querySelector('[value="cancel"]').formNoValidate=true;
 const details=()=>{const milk=d.querySelector('select')?.value,syrups=[...d.querySelectorAll('[name="syrup"]:checked')].map(i=>i.value);return{price:base+(milk&&milk!=='Dairy'?.5:0)+syrups.length*.95,detail:[milk?milk+' milk':'',...syrups.map(s=>s+' syrup'),d.querySelector('#decaf')?.checked?'Decaf':'',d.querySelector('#iced')?.checked?'Iced':''].filter(Boolean).join(' · ')}};
 d.addEventListener('change',()=>{d.querySelector('.confirmDip').textContent='Add to order · '+money(details().price)});
 d.addEventListener('close',()=>{if(d.returnValue==='add'){const order=details();add(name,order.price,order.detail)}d.remove()});openDialog(d);
}
