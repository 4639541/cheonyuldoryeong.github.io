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
