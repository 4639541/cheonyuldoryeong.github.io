const kakaoUrl='https://qr.kakaopay.com/281006011000002710315576';
function showPage(id){
  const target=document.getElementById(id)||document.getElementById('home');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  target.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(btn=>{
    if(btn.closest('.bottomNav')) btn.classList.toggle('active', btn.dataset.page===target.id);
  });
  sessionStorage.setItem('cheonyulPage', target.id);
  window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click', e=>{
  const nav=e.target.closest('[data-page]');
  if(nav){e.preventDefault();showPage(nav.dataset.page);return;}
  const copy=e.target.closest('[data-copy]');
  if(copy){e.preventDefault();navigator.clipboard.writeText(copy.dataset.copy).then(()=>alert('복사되었습니다.'));return;}
});
window.addEventListener('load',()=>{
  showPage(sessionStorage.getItem('cheonyulPage')||'home');
  const kakao=document.getElementById('kakaoPayBtn');
  if(kakao) kakao.onclick=e=>{e.preventDefault();location.href=kakaoUrl;};
  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;});
  const install=document.getElementById('installBtn');
  if(install) install.onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;}else alert('브라우저 메뉴에서 홈 화면에 추가를 이용해 주세요.');};
});

function applySavedProfileImage(){
  const saved = localStorage.getItem('cheonyulProfileImage');
  if(!saved) return;
  document.querySelectorAll('.profile,.smallProfile').forEach(img => img.src = saved);
}
window.addEventListener('load', applySavedProfileImage);
window.addEventListener('storage', applySavedProfileImage);

const defaultProducts2=[{name:'평안 염주',price:'25,000원',desc:'마음의 불안을 내려놓고 평안과 안정을 전하는 염주입니다.'}];
function getJSON2(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch(e){return fallback}}
function renderAdminLinkedData(){
  const saved=localStorage.getItem('cheonyulProfileImage');
  if(saved) document.querySelectorAll('.profile,.smallProfile').forEach(img=>img.src=saved);
  const notice=document.getElementById('noticeArea');
  if(notice){const n=localStorage.getItem('cheonyulNotice');notice.innerHTML=n?`<h2>공지사항</h2><p>${n}</p>`:'<h2>공지사항</h2><p>등록된 공지가 없습니다.</p>';}
  const product=document.getElementById('productList');
  if(product){const items=getJSON2('cheonyulProducts',defaultProducts2);product.innerHTML=items.map(p=>`<div class="card"><h2>${p.name}</h2><p>${p.desc||''}</p><p class="gold">${p.price}</p><button type="button" class="primary" data-page="payment">구매/결제 안내</button></div>`).join('');}
  const review=document.getElementById('reviewList');
  if(review){const items=getJSON2('cheonyulReviews',[]);review.innerHTML=items.map(r=>`<div class="card"><h2>${r.title}</h2><p>${r.text}</p></div>`).join('')||'<div class="card"><p>상담 후기는 순차적으로 등록됩니다.</p></div>';}
}
window.addEventListener('load', renderAdminLinkedData);
window.addEventListener('storage', renderAdminLinkedData);
