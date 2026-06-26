import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),db=getFirestore(app),storage=getStorage(app),auth=getAuth(app);
const $=id=>document.getElementById(id);
const esc=v=>String(v??"");
const money=v=>Number(String(v||"").replace(/[^\d]/g,""))||0;
const won=n=>(Number(n)||0).toLocaleString()+"원";

let state={
  products:[], prices:[], notices:[], reviews:[], coupons:[], orders:[], bookings:[], banners:[], benefits:[], settings:[], consultRecords:[], spiritualRequests:[], notifications:[], schedules:[], chats:[], points:[], events:[], memberFiles:[], seoSettings:[], adminRoles:[],
  payment:{name:"천율도령",account:"02002407816",guide:"송금 후 주문 신청"},
  booking:{times:["오전 10시","오후 2시","오후 7시"],blockedDates:[]}
};
let cart=JSON.parse(localStorage.cyMobileCart||"[]");
let coupon=null, couponDiscount=0, user=null, member=null;
let favorites=JSON.parse(localStorage.cyFavorites||"[]");
let recentViewed=JSON.parse(localStorage.cyRecentViewed||"[]");
let started=false;


// ===== 4.5 complete sync additions =====
function getBusiness(){
  const b=state.settings.find(s=>s.id==="business")||{};
  return {
    name:b.name||"천율도령", owner:b.owner||"정세진", number:b.number||"570-76-00713",
    address:b.address||"경상북도 구미시 상모로12길 49, 101동 102호",
    type:b.type||"협회 및 단체, 수리 및 기타 개인서비스업", item:b.item||"점술 및 유사 서비스업",
    contact:b.contact||"카카오톡 오픈프로필 천율도령", mailOrder:b.mailOrder||"신고 예정"
  };
}
function renderBusiness(){
  const box=$("businessInfoHome"); if(!box) return;
  const b=getBusiness();
  box.innerHTML=`<p>상호: ${esc(b.name)}</p><p>대표자: ${esc(b.owner)}</p><p>사업자등록번호: ${esc(b.number)}</p><p>주소: ${esc(b.address)}</p><p>업태: ${esc(b.type)}</p><p>종목: ${esc(b.item)}</p><p>고객문의: ${esc(b.contact)}</p><p>통신판매업신고: ${esc(b.mailOrder)}</p>`;
}
function couponValid(c){
  if(c.minOrder && subtotal() < money(c.minOrder)) return `최소 주문금액 ${won(money(c.minOrder))} 이상 사용 가능합니다.`;
  if(c.expiresAt){
    const exp = String(c.expiresAt);
    const today = new Date().toISOString().slice(0,10);
    if(exp < today) return "만료된 쿠폰입니다.";
  }
  if(c.useLimit && Number(c.usedCount||0) >= Number(c.useLimit)) return "사용 가능 횟수를 초과한 쿠폰입니다.";
  return "";
}
async function decreaseStockAfterOrder(){
  for(const item of cart){
    if(item.type!=="product") continue;
    const p=state.products.find(x=>x.id===item.id);
    if(!p) continue;
    const stock = Number(String(p.stock||"").replace(/[^\d]/g,""));
    if(Number.isFinite(stock) && stock > 0){
      await updateDoc(doc(db,"products",p.id),{stock:String(Math.max(0,stock-item.qty)),updatedAt:serverTimestamp()});
    }
  }
}
function isBooked(date,time){
  return state.bookings.some(b=>b.date===date && b.time===time && !String(b.status||"").includes("취소"));
}


// ===== 4.6 operation complete additions =====
async function submitSpiritual(){
  if(!$("spName").value || !$("spContact").value) return alert("이름과 연락처를 입력해 주세요.");
  await addDoc(collection(db,"spiritualRequests"),{
    name:$("spName").value, contact:$("spContact").value, type:$("spType").value,
    amount:$("spAmount").value, body:$("spBody").value,
    memberUid:member?.uid||member?.id||"", memberEmail:member?.email||"",
    status:"신청접수", createdAt:serverTimestamp()
  });
  await addDoc(collection(db,"notifications"),{target:"admin",title:"부적/초발원 신청 알림",body:`${$("spName").value} / ${$("spType").value}`,createdAt:serverTimestamp()});
  alert("신청이 접수되었습니다.");
}
function renderConsultRecords(){
  const box=$("myConsultRecords"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 상담 이력을 확인할 수 있습니다.</p>"; return;}
  const uid=member.uid||member.id;
  const rows=(state.consultRecords||[]).filter(r=>r.memberUid===uid || r.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(r=>`<article class="card"><h3>${esc(r.title||"상담 이력")}</h3><p>${esc(r.date||"")}</p><p>${esc(r.memo||"")}</p>${r.nextDate?`<p>재상담 예정: ${esc(r.nextDate)}</p>`:""}</article>`).join(""):"<p>등록된 상담 이력이 없습니다.</p>";
}
async function requestRefund(col,id){
  const reason=prompt("환불/취소 사유를 입력해 주세요.");
  if(reason===null)return;
  await updateDoc(doc(db,col,id),{status:"환불요청",refundReason:reason,refundRequestedAt:serverTimestamp()});
  alert("환불/취소 요청이 접수되었습니다.");
}


// ===== 4.7 CRM / Dashboard / Alerts additions =====
function renderNotifications(){
  const box=$("myNotifications"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 알림을 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.notifications||[]).filter(n=>n.memberUid===uid || n.memberEmail===member.email || n.target==="all");
  box.innerHTML=rows.length?rows.slice(0,10).map(n=>`<article class="card ${n.read?'':'highlightCard'}"><h3>${esc(n.title||"알림")}</h3><p>${esc(n.body||"")}</p><small>${n.createdAt?.seconds?new Date(n.createdAt.seconds*1000).toLocaleString():""}</small></article>`).join(""):"<p>새 알림이 없습니다.</p>";
}
function renderProgressCenter(){
  const box=$("myProgressList"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 진행 현황을 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const spirituals=(state.spiritualRequests||[]).filter(s=>s.memberUid===uid||s.memberEmail===member.email||s.contact===member.contact);
  const orders=(state.orders||[]).filter(o=>o.memberUid===uid||o.memberEmail===member.email||o.contact===member.contact);
  const bookings=(state.bookings||[]).filter(b=>b.memberUid===uid||b.memberEmail===member.email||b.contact===member.contact);
  box.innerHTML=[
    ...spirituals.map(s=>`<article class="card"><h3>${esc(s.type||"신청")}</h3><p>상태: ${esc(s.status||"접수")}</p><p>${esc(s.body||"")}</p></article>`),
    ...orders.map(o=>`<article class="card"><h3>주문 ${esc(o.orderNo||"")}</h3><p>상태: ${esc(o.status||"")}</p><p>배송: ${esc(o.trackingCompany||"등록 전")} ${esc(o.trackingNo||"")}</p></article>`),
    ...bookings.map(b=>`<article class="card"><h3>${esc(b.type||"상담 예약")}</h3><p>${esc(b.date)} ${esc(b.time)}</p><p>상태: ${esc(b.status||"")}</p></article>`)
  ].join("") || "<p>진행 중인 내역이 없습니다.</p>";
}


// ===== 4.8 chat / points / referral additions =====
function referralCode(){
  if(!member) return "";
  return "CY" + String(member.uid||member.id||"").slice(0,6).toUpperCase();
}
function renderReferral(){
  const box=$("myReferralBox"); if(!box) return;
  if(!member){box.innerHTML="로그인 후 추천인 코드를 확인할 수 있습니다.";return;}
  box.innerHTML=`<h3>내 추천인 코드</h3><div class="price">${referralCode()}</div><p>친구가 이 코드를 입력하면 추천 보상이 지급될 수 있습니다.</p><p>보유 적립금: <b>${won(Number(member.points||0))}</b></p>`;
}
async function saveReferralCode(){
  if(!member)return alert("로그인 후 이용해 주세요.");
  const code=($("referralInput").value||"").trim().toUpperCase();
  if(!code)return alert("추천인 코드를 입력해 주세요.");
  if(member.referredBy)return alert("이미 추천인을 등록했습니다.");
  await updateDoc(doc(db,"members",member.uid||member.id),{referredBy:code,updatedAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"추천인 등록",body:`${member.name||member.email} / ${code}`,createdAt:serverTimestamp()});
  alert("추천인이 등록되었습니다.");
}
function renderPointHistory(){
  const box=$("pointHistory"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.points||[]).filter(p=>p.memberUid===uid||p.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(p=>`<article class="card"><h3>${won(Number(p.amount||0))}</h3><p>${esc(p.reason||"적립금")}</p></article>`).join(""):"<p>적립금 내역이 없습니다.</p>";
}
function renderEvents(){
  if($("homeBenefitList")){
    const eventCards=(state.events||[]).slice(0,3).map(e=>`<article class="card benefitCard"><h3>${esc(e.title||"이벤트")}</h3><p>${esc(e.body||"")}</p><small>종료일: ${esc(e.endDate||"-")}</small></article>`).join("");
    if(eventCards) $("homeBenefitList").innerHTML=eventCards + $("homeBenefitList").innerHTML;
  }
}
function chatThreadId(){return member ? (member.uid||member.id) : "";}
function renderChat(){
  const guide=$("chatLoginGuide"), box=$("chatBox"); if(!box) return;
  if(!member){ if(guide)guide.style.display="block"; box.innerHTML=""; return; }
  if(guide)guide.style.display="none";
  const uid=chatThreadId();
  const rows=(state.chats||[]).filter(c=>c.threadId===uid).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
  box.innerHTML=rows.map(m=>`<div class="msg ${m.sender==='admin'?'adminMsg':'userMsg'}"><b>${m.sender==='admin'?'천율도령':'나'}</b><p>${esc(m.text||"")}</p></div>`).join("")||"<p>상담 메시지를 남겨주세요.</p>";
  box.scrollTop=box.scrollHeight;
}
async function sendChat(){
  if(!member)return alert("로그인 후 이용해 주세요.");
  const text=($("chatInput").value||"").trim(); if(!text)return;
  await addDoc(collection(db,"chats"),{threadId:chatThreadId(),memberUid:member.uid||member.id,memberEmail:member.email,memberName:member.name||"",sender:"user",text,read:false,createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"새 채팅 메시지",body:`${member.name||member.email}: ${text}`,createdAt:serverTimestamp()});
  $("chatInput").value="";
}


// ===== 5.0 full platform additions =====
function renderMemberFiles(){
  const box=$("myFilesList"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 상담 자료를 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.memberFiles||[]).filter(f=>f.memberUid===uid||f.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(f=>`<article class="card"><h3>${esc(f.title||"상담 자료")}</h3><p>${esc(f.memo||"")}</p>${(f.urls||[]).map((u,i)=>`<a class="secondary fileLink" target="_blank" href="${u}">자료 ${i+1} 열기</a>`).join("")}</article>`).join(""):"<p>등록된 자료가 없습니다.</p>";
}
function renderReceipts(){
  const box=$("myReceiptList"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.orders||[]).filter(o=>o.memberUid===uid||o.memberEmail===member.email||o.contact===member.contact);
  box.innerHTML=rows.length?rows.map(o=>`<article class="card receipt"><h3>주문서 ${esc(o.orderNo||"")}</h3><p>주문자: ${esc(o.name||"")}</p><p>금액: ${esc(o.total||"")}</p><p>상태: ${esc(o.status||"")}</p><button class="secondary" onclick="window.print()">인쇄/저장</button></article>`).join(""):"<p>주문 내역이 없습니다.</p>";
}
function applySeo(){
  const s=(state.seoSettings||[])[0];
  if(!s)return;
  if(s.title) document.title=s.title;
  let d=document.querySelector('meta[name="description"]'); if(d&&s.desc)d.setAttribute("content",s.desc);
}

const defaults={
  prices:[{title:"한 질문 상담",price:"20,000원",desc:"핵심 질문"},{title:"세 질문 상담",price:"50,000원",desc:"세 가지 질문"},{title:"궁합 상담",price:"80,000원",desc:"궁합 흐름"},{title:"신점 상담",price:"120,000원",desc:"심층 상담"}],
  notices:[{title:"상담은 예약제로 진행됩니다.",body:"입금 확인 후 순차적으로 안내됩니다."}]
};

function setSync(t,ok=true){const el=$("syncStatus"); if(el){el.textContent=t; el.className=ok?"syncStatus ok":"syncStatus bad";}}
async function once(col){const s=await getDocs(collection(db,col)); return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));}
function listen(col,key){onSnapshot(collection(db,col),snap=>{state[key]=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); hydrate(); renderAll(); setSync("실시간 연동중",true);},e=>{console.error(e); setSync("연동 오류",false);});}
function hydrate(){
  state.prices = state.prices.length ? state.prices : defaults.prices;
  state.notices = state.notices.length ? state.notices : defaults.notices;
  const pay=state.settings.find(s=>s.id==="payment"); if(pay) state.payment=pay;
  const time=state.settings.find(s=>s.id==="bookingTimes"); if(time) state.booking={times:time.times||state.booking.times,blockedDates:time.blockedDates||[]};
}
function go(id){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(id)?.classList.add("active");document.querySelectorAll(".bottomNav button").forEach(b=>b.classList.toggle("on",b.dataset.go===id));window.scrollTo(0,0); renderAll();}
function open(id){$(id)?.classList.add("show");document.body.classList.add("modalOpen")}
function close(id){$(id)?.classList.remove("show");if(!document.querySelector(".modal.show"))document.body.classList.remove("modalOpen")}
function subtotal(){return cart.reduce((s,i)=>s+money(i.price)*i.qty,0)}
function total(){return Math.max(0,subtotal()-couponDiscount)}
function saveCart(){localStorage.cyMobileCart=JSON.stringify(cart); if($("cartCount"))$("cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0)}
function imgTag(src){return src?`<img class="productImg" src="${src}" loading="lazy">`:""}

function renderAll(){
  renderHome();
  renderProducts();
  renderBooking();
  renderReviews();
  renderBenefits();
  renderMember();
  renderBusiness();
  renderConsultRecords();
  renderNotifications();
  renderProgressCenter();
  renderReferral();
  renderPointHistory();
  renderEvents();
  renderChat();
  renderMemberFiles();
  renderReceipts();
  applySeo();
  saveCart();
}
function renderHome(){
  if($("priceList")) $("priceList").innerHTML=state.prices.map(p=>`<article class="card"><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p><div class="price">${esc(p.price)}</div><button class="primary addConsult" data-name="${esc(p.title)}" data-price="${esc(p.price)}">상담 담기</button></article>`).join("");
  document.querySelectorAll(".addConsult").forEach(b=>b.onclick=()=>addCart({id:"consult-"+b.dataset.name,name:b.dataset.name,price:b.dataset.price,qty:1,type:"consult"}));
  if($("noticeList")) $("noticeList").innerHTML=state.notices.map(n=>`<article class="card"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join("");
  if($("homeBannerList")) $("homeBannerList").innerHTML=state.banners.length?state.banners.slice(0,3).map(b=>`<article class="card highlightCard"><h3>${esc(b.title||"공지")}</h3><p>${esc(b.body||"")}</p></article>`).join(""):`<article class="card"><h3>천율도령 공식 안내</h3><p>관리자 홈관리에서 배너를 등록하면 즉시 표시됩니다.</p></article>`;
  if($("homeBenefitList")) $("homeBenefitList").innerHTML=state.benefits.length?state.benefits.slice(0,3).map(b=>`<article class="card benefitCard"><h3>${esc(b.title||"회원 혜택")}</h3><p>${esc(b.body||"")}</p></article>`).join(""):`<article class="card"><h3>회원 전용 혜택</h3><p>로그인 후 쿠폰과 적립금을 확인하세요.</p></article>`;
  if($("paymentSummaryHome")) $("paymentSummaryHome").innerHTML=`<article class="card"><h3>카카오페이 / 계좌이체</h3><p>${esc(state.payment.guide||"송금 후 주문 신청")}</p><p>카카오페이: ${esc(state.payment.account||"등록 전")}</p>${state.payment.bankAccount?`<p>계좌: ${esc(state.payment.bankName)} ${esc(state.payment.bankAccount)}</p>`:""}</article>`;
}
function renderProducts(){
  const q=($("search")?.value||"").toLowerCase();
  const rows=state.products.filter(p=>!q||`${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q));
  if($("productList")) $("productList").innerHTML=rows.map(p=>`<article class="card">${imgTag(p.images?.[0])}<h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p><div class="price">${esc(p.sale||p.price)}</div><button class="primary addProduct" data-id="${p.id}">담기</button><button class="secondary favProduct" data-id="${p.id}">즐겨찾기</button></article>`).join("")||"<p>등록된 상품이 없습니다.</p>";
  document.querySelectorAll(".addProduct").forEach(b=>b.onclick=()=>{let p=state.products.find(x=>x.id===b.dataset.id); if(p){addRecent(p); addCart({id:p.id,name:p.name,price:p.sale||p.price,qty:1,type:"product"});}});
  document.querySelectorAll(".favProduct").forEach(b=>b.onclick=()=>{let p=state.products.find(x=>x.id===b.dataset.id); toggleFav(p);});
}
function renderBooking(){
  if($("bookType")) $("bookType").innerHTML=state.prices.map(p=>`<option>${esc(p.title)} ${esc(p.price)}</option>`).join("");
  renderTimes();
}
function renderReviews(){
  const reviews=state.reviews.filter(r=>r.approved);
  if($("reviewList")) $("reviewList").innerHTML=reviews.map(r=>`<article class="card"><h3>${esc(r.stars)} ${esc(r.name)}</h3><p>${esc(r.body)}</p></article>`).join("")||"<p>승인된 후기가 없습니다.</p>";
}
function renderBenefits(){
  if($("memberGradeBox")) $("memberGradeBox").innerHTML=member?`<h3>${esc(member.name||"회원")}님</h3><p>회원등급: <b>${grade()}</b></p><p>이메일: ${esc(member.email||"")}</p>`:`<p>로그인 후 회원 등급을 확인할 수 있습니다.</p>`;
  if($("pointBox")) $("pointBox").innerHTML=`<div class="card"><h3>보유 적립금</h3><div class="price">${won(Number(member?.points||0))}</div></div>`;
  if($("favoriteList")) $("favoriteList").innerHTML=favorites.length?favorites.map(p=>`<article class="card">${imgTag(p.image)}<h3>${esc(p.name)}</h3><p>${esc(p.price)}</p></article>`).join(""):"<p>즐겨찾기한 상품이 없습니다.</p>";
  if($("recentList")) $("recentList").innerHTML=recentViewed.length?recentViewed.map(p=>`<article class="card">${imgTag(p.image)}<h3>${esc(p.name)}</h3><p>${esc(p.price)}</p></article>`).join(""):"<p>최근 본 상품이 없습니다.</p>";
}
function grade(){const pts=Number(member?.points||0); if(pts>=100000)return"VIP"; if(pts>=50000)return"GOLD"; if(pts>=10000)return"SILVER"; return"일반";}
function addRecent(p){recentViewed=recentViewed.filter(x=>x.id!==p.id);recentViewed.unshift({id:p.id,name:p.name,price:p.sale||p.price,image:p.images?.[0]||""});recentViewed=recentViewed.slice(0,10);localStorage.cyRecentViewed=JSON.stringify(recentViewed)}
function toggleFav(p){if(!p)return;const e=favorites.find(x=>x.id===p.id);favorites=e?favorites.filter(x=>x.id!==p.id):[{id:p.id,name:p.name,price:p.sale||p.price,image:p.images?.[0]||""},...favorites];localStorage.cyFavorites=JSON.stringify(favorites);alert("즐겨찾기에 반영되었습니다.");renderBenefits();}
function addCart(i){let f=cart.find(x=>x.id===i.id);f?f.qty++:cart.push(i);saveCart();alert("담았습니다.")}
function renderCart(){
  if($("cartItems")) $("cartItems").innerHTML=cart.map((i,k)=>`<div class="cartItem"><div><b>${esc(i.name)}</b><br>${esc(i.price)} × ${i.qty}</div><button class="remove" data-i="${k}">삭제</button></div>`).join("")||"<p>장바구니가 비어 있습니다.</p>";
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.i,1);saveCart();renderCart()});
  if($("subtotal"))$("subtotal").textContent=won(subtotal());
  if($("discount"))$("discount").textContent=won(couponDiscount);
  if($("total"))$("total").textContent=won(total());
  if($("couponText"))$("couponText").textContent=coupon?`${coupon.code} / ${won(couponDiscount)} 할인`:"적용된 쿠폰이 없습니다.";
}
function renderPay(){
  const p=state.payment;
  if($("payInfo")) $("payInfo").innerHTML=`<div class="payCard"><b>카카오페이</b><div class="payNum">${esc(p.account||"02002407816")}</div>${p.link?`<a class="primary" target="_blank" href="${p.link}">카카오페이 송금하기</a>`:""}<button class="copy" data-copy="${esc(p.account||"02002407816")}">카카오페이 번호 복사</button></div>${p.bankAccount?`<div class="payCard"><b>계좌이체</b><div class="payNum">${esc(p.bankName)} ${esc(p.bankAccount)}</div><p>예금주: ${esc(p.bankOwner)}</p><button class="copy" data-copy="${esc(p.bankAccount)}">계좌번호 복사</button></div>`:""}<p>${esc(p.guide||"송금 후 주문 신청")}</p>`;
  document.querySelectorAll(".copy").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy)}catch(e){const t=document.createElement("textarea");t.value=b.dataset.copy;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}alert("복사되었습니다.")});
}
async function applyCoupon(){
  const code=($("couponInput")?.value||"").trim().toUpperCase(); if(!code)return alert("쿠폰 코드를 입력하세요.");
  const c=state.coupons.find(x=>(x.code||"").toUpperCase()===code); if(!c)return alert("등록되지 않은 쿠폰입니다."); if(c.used)return alert("이미 사용된 쿠폰입니다.");
  if(c.memberUid||c.memberEmail){if(!member)return alert("회원 전용 쿠폰입니다."); if(c.memberUid&&c.memberUid!==(member.uid||member.id))return alert("해당 회원 쿠폰입니다."); if(c.memberEmail&&c.memberEmail!==member.email)return alert("해당 회원 쿠폰입니다.");}
  coupon=c; couponDiscount=money(c.discount); renderCart(); alert("쿠폰 적용 완료");
}
function orderNo(){return"CY"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+Math.random().toString(36).slice(2,7).toUpperCase()}
async function order(){
  if(!cart.length)return alert("장바구니가 비었습니다.");
  if(!$("orderName").value||!$("orderContact").value)return alert("이름과 연락처를 입력하세요.");
  const no=orderNo();
  await addDoc(collection(db,"orders"),{orderNo:no,items:cart,subtotal:won(subtotal()),discount:couponDiscount,coupon:coupon?.code||"",total:won(total()),name:$("orderName").value,contact:$("orderContact").value,address:$("orderAddress").value,memo:$("orderMemo").value,memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",status:"입금대기",createdAt:serverTimestamp()});
  await decreaseStockAfterOrder();
  await addDoc(collection(db,"notifications"),{target:"admin",title:"새 주문 접수",body:`${$("orderName").value} / ${won(total())}`,createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",title:"주문 접수 알림",body:`주문번호 ${no} 접수 완료`,createdAt:serverTimestamp()});
  if(coupon?.id)try{await updateDoc(doc(db,"coupons",coupon.id),{used:true,usedAt:serverTimestamp(),usedCount:Number(coupon.usedCount||0)+1})}catch(e){}
  if(member){const point=Math.floor(total()*0.01); if(point>0){await addDoc(collection(db,"points"),{memberUid:member.uid||member.id,memberEmail:member.email,amount:point,reason:"주문 적립금",createdAt:serverTimestamp()}); try{await updateDoc(doc(db,"members",member.uid||member.id),{points:Number(member.points||0)+point,updatedAt:serverTimestamp()})}catch(e){}}}
  cart=[]; coupon=null; couponDiscount=0; saveCart(); close("cartModal"); alert("주문 완료\n주문번호: "+no);
}
function renderTimes(){const d=$("bookDate")?.value, blocked=state.booking.blockedDates.includes(d); if($("bookTime")) $("bookTime").innerHTML=blocked?"<option>예약 마감</option>":state.booking.times.map(t=>`<option>${t}</option>`).join("")}
async function book(){
  if(!$("bookName").value||!$("bookContact").value||!$("bookDate").value)return alert("예약 정보를 입력하세요.");
  if(isBooked($("bookDate").value,$("bookTime").value)) return alert("이미 예약된 시간입니다. 다른 시간을 선택해 주세요.");
  const bookingTitle=$("bookType").value;
  await addDoc(collection(db,"bookings"),{name:$("bookName").value,contact:$("bookContact").value,type:$("bookType").value,date:$("bookDate").value,time:$("bookTime").value,body:$("bookBody").value,memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",status:"대기",createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"새 예약 접수",body:`${$("bookName").value} / ${bookingTitle}`,createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",title:"예약 접수 알림",body:`${$("bookDate").value} ${$("bookTime").value} 예약 신청 완료`,createdAt:serverTimestamp()});
  alert("예약 신청 완료");
}
async function track(){
  const o=state.orders.find(x=>x.orderNo===$("trackNo").value.trim()&&x.contact===$("trackContact").value.trim());
  if($("trackResult")) $("trackResult").innerHTML=o?`<div class="card"><b>${o.orderNo}</b><p>${o.status}</p><p>${o.trackingCompany||"등록 전"} ${o.trackingNo||""}</p></div>`:"<p>주문을 찾지 못했습니다.</p>";
}
async function upload(fs,folder){let u=[];for(let f of Array.from(fs||[])){let r=ref(storage,`${folder}/${Date.now()}_${f.name}`);await uploadBytes(r,f);u.push(await getDownloadURL(r))}return u}
async function review(){
  const imgs=await upload($("reviewImages").files,"reviews");
  await addDoc(collection(db,"reviews"),{name:$("reviewName").value,category:$("reviewCategory").value,stars:$("reviewStars").value,body:$("reviewBody").value,images:imgs,approved:false,createdAt:serverTimestamp()});
  close("reviewModal"); alert("후기 등록 요청 완료");
}
async function join(){
  try{
    const cr=await createUserWithEmailAndPassword(auth,$("joinEmail").value.trim(),$("joinPw").value);
    await setDoc(doc(db,"members",cr.user.uid),{uid:cr.user.uid,name:$("joinName").value,contact:$("joinContact").value,email:$("joinEmail").value.trim(),points:0,createdAt:serverTimestamp()},{merge:true});
    // 회원가입 자동 쿠폰
    await addDoc(collection(db,"coupons"),{code:"WELCOME-"+Math.random().toString(36).slice(2,7).toUpperCase(),discount:"5000",desc:"신규 회원 쿠폰",used:false,memberUid:cr.user.uid,memberEmail:$("joinEmail").value.trim(),memberName:$("joinName").value,createdAt:serverTimestamp()});
    alert("회원가입 완료\n신규 회원 쿠폰이 발급되었습니다."); close("authModal");
  }catch(e){alert(e.code==="auth/email-already-in-use"?"이미 가입된 이메일입니다. 로그인해 주세요.":"회원가입 실패: "+e.message)}
}
async function login(){try{await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPw").value);alert("로그인 완료");close("authModal")}catch(e){alert("로그인 실패")}}
async function loadMember(u){user=u;if(!u){member=null;renderMember();return}let m=state.members?.find(x=>x.id===u.uid); if(!m){const ms=await once("members");m=ms.find(x=>x.id===u.uid)} member=m||{uid:u.uid,email:u.email}; renderMember(); fill();}
function renderMember(){
  if($("loginOpen"))$("loginOpen").textContent=member?"내 정보":"로그인";
  if($("memberBox"))$("memberBox").innerHTML=member?`<b>${esc(member.name||"회원")}</b><p>${esc(member.email)}</p><button id="logout" class="secondary">로그아웃</button>`:"<p>로그인하면 내 쿠폰과 주문/예약을 확인할 수 있습니다.</p><button class='primary' id='mypageLoginBtn'>로그인/회원가입</button>";
  if($("logout"))$("logout").onclick=()=>signOut(auth);
  if($("mypageLoginBtn"))$("mypageLoginBtn").onclick=()=>open("authModal");
  if(member){loadMyCoupons();loadHistory();renderBenefits()}else{renderBenefits(); if($("myCoupons"))$("myCoupons").innerHTML="<p>로그인 후 확인 가능합니다.</p>"; if($("myHistory"))$("myHistory").innerHTML="<p>로그인 후 확인 가능합니다.</p>";}
}
function loadMyCoupons(){
  const uid=member.uid||member.id, my=state.coupons.filter(c=>c.memberUid===uid||c.memberEmail===member.email);
  if($("myCoupons"))$("myCoupons").innerHTML=my.map(c=>`<div class="myCoupon ${c.used?"used":""}"><b>${c.code}</b><p>${won(money(c.discount))} 할인 / ${c.used?"사용완료":"사용가능"}</p>${!c.used?`<button class="secondary useCoupon" data-code="${c.code}">사용하기</button>`:""}</div>`).join("")||"<p>발급된 쿠폰이 없습니다.</p>";
  document.querySelectorAll(".useCoupon").forEach(b=>b.onclick=()=>{$("couponInput").value=b.dataset.code;openCart()});
}
function loadHistory(){
  const uid=member.uid||member.id;
  const myO=state.orders.filter(o=>o.memberUid===uid||o.contact===member.contact), myB=state.bookings.filter(b=>b.memberUid===uid||b.contact===member.contact);
  if($("myHistory"))$("myHistory").innerHTML=(myO.map(o=>`<div class="myCoupon"><b>${o.orderNo}</b><p>${o.total} / ${o.status}</p><button class="secondary cancelOrder" data-id="${o.id}">취소 요청</button><button class="secondary refundOrder" data-id="${o.id}">환불 요청</button></div>`).join("")+myB.map(b=>`<div class="myCoupon"><b>${b.type}</b><p>${b.date} ${b.time} / ${b.status}</p><button class="secondary cancelBook" data-id="${b.id}">상담취소 요청</button><button class="secondary refundBook" data-id="${b.id}">환불 요청</button></div>`).join(""))||"<p>내역이 없습니다.</p>";
  document.querySelectorAll(".cancelOrder").forEach(b=>b.onclick=()=>cancel("orders",b.dataset.id));
  document.querySelectorAll(".cancelBook").forEach(b=>b.onclick=()=>cancel("bookings",b.dataset.id));
  document.querySelectorAll(".refundOrder").forEach(b=>b.onclick=()=>requestRefund("orders",b.dataset.id));
  document.querySelectorAll(".refundBook").forEach(b=>b.onclick=()=>requestRefund("bookings",b.dataset.id));
}
async function cancel(col,id){let r=prompt("취소 사유");if(r===null)return;await updateDoc(doc(db,col,id),{status:"취소요청",cancelReason:r,updatedAt:serverTimestamp()});alert("취소 요청 완료")}
function fill(){if(!member)return;[["orderName",member.name],["orderContact",member.contact],["bookName",member.name],["bookContact",member.contact]].forEach(([id,v])=>{if($(id)&&!$(id).value)$(id).value=v||""})}
function openCart(){fill();renderCart();renderPay();open("cartModal")}
async function recordVisit(){try{const key="visit_"+new Date().toISOString().slice(0,10);if(localStorage.cyVisitKey===key)return;localStorage.cyVisitKey=key;await addDoc(collection(db,"visits"),{date:new Date().toISOString().slice(0,10),createdAt:serverTimestamp()})}catch(e){}}
function bind(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>close(b.dataset.close));
  document.querySelectorAll(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)close(m.id)});
  $("loginOpen").onclick=()=>member?go("mypage"):open("authModal");
  $("loginTab").onclick=()=>{$("loginTab").classList.add("on");$("joinTab").classList.remove("on");$("loginPanel").classList.remove("hide");$("joinPanel").classList.add("hide")};
  $("joinTab").onclick=()=>{$("joinTab").classList.add("on");$("loginTab").classList.remove("on");$("joinPanel").classList.remove("hide");$("loginPanel").classList.add("hide")};
  $("joinBtn").onclick=join; $("loginBtn").onclick=login; $("cartOpen").onclick=openCart; $("search").oninput=renderProducts; $("couponApply").onclick=applyCoupon; $("orderBtn").onclick=order; $("bookBtn").onclick=book; $("bookDate").onchange=renderTimes; $("trackBtn").onclick=track; $("reviewOpen").onclick=()=>open("reviewModal"); $("reviewSubmit").onclick=review; if($("chatSend"))$("chatSend").onclick=sendChat; if($("saveReferral"))$("saveReferral").onclick=saveReferralCode; if($("spSubmit"))$("spSubmit").onclick=submitSpiritual;
}
function startSync(){
  if(started)return; started=true;
  const map={products:"products",consultPrices:"prices",notices:"notices",reviews:"reviews",settings:"settings",coupons:"coupons",orders:"orders",bookings:"bookings",banners:"banners",benefits:"benefits",members:"members",consultRecords:"consultRecords",spiritualRequests:"spiritualRequests",notifications:"notifications",schedules:"schedules",chats:"chats",points:"points",events:"events",memberFiles:"memberFiles",seoSettings:"seoSettings",adminRoles:"adminRoles"};
  Object.entries(map).forEach(([col,key])=>listen(col,key));
}
bind(); hydrate(); renderAll(); startSync(); recordVisit(); onAuthStateChanged(auth,loadMember);
