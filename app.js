import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, addDoc, collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig), db=getFirestore(app), storage=getStorage(app), auth=getAuth(app);
const $=id=>document.getElementById(id); let products=[],cart=JSON.parse(localStorage.cyCart||"[]"),payment={},coupon=null,couponDiscount=0,currentMember=null,booking={times:["오전","오후","저녁"],blockedDates:[]};
const defaults={notices:[{tag:"공지",title:"상담은 예약제로 진행됩니다.",body:"카카오톡으로 순차 안내드립니다."}],prices:[{title:"한 질문 상담",price:"20,000원",badge:"기본",desc:"핵심 질문 상담"},{title:"세 질문 상담",price:"50,000원",badge:"추천",desc:"세 가지 질문 상담"},{title:"궁합 상담",price:"80,000원",badge:"관계",desc:"관계 흐름 상담"},{title:"심층 신점 상담",price:"120,000원",badge:"심층",desc:"전반 상담"}],products:[{id:"demo",name:"상담 예약 상품",category:"상담",price:"20,000원",stock:"예약 가능",desc:"관리자에서 상품을 등록하세요.",images:[]}],reviews:[],posts:[]};
const esc=v=>String(v??""), money=v=>Number(String(v||"").replace(/[^\d]/g,""))||0, won=n=>(Number(n)||0).toLocaleString()+"원";
async function list(c,f=[]){try{let s=await getDocs(collection(db,c));let a=s.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>(y.createdAt?.seconds||0)-(x.createdAt?.seconds||0));return a.length?a:f}catch(e){console.warn(c,e);return f}}
function gallery(a=[]){return a.length?`<div class="gallery">${a.map(x=>`<img src="${x}">`).join("")}</div>`:""}
function sub(){return cart.reduce((s,i)=>s+money(i.price)*i.qty,0)} function total(){return Math.max(0,sub()-couponDiscount)} function saveCart(){localStorage.cyCart=JSON.stringify(cart);$("cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0)}
async function init(){
  bind();
  await loadAll();
  startRealtimeSync();
  onAuthStateChanged(auth,loadMember);
}
function bind(){
  $("menuBtn").onclick=()=>$("navMenu").classList.toggle("show");
  $("cartBtn").onclick=openCart;
  $("cartClose").onclick=()=>closeModal("cartModal");
  $("couponApply").onclick=applyCoupon;
  $("orderBtn").onclick=order;
  $("bookingBtn").onclick=book;
  $("bookDate").onchange=renderTimes;
  $("trackBtn").onclick=track;
  $("reviewOpenBtn").onclick=()=>openModal("reviewModal");
  $("reviewClose").onclick=()=>closeModal("reviewModal");
  $("reviewSubmit").onclick=review;
  $("searchInput").oninput=renderProducts;
  $("categorySelect").onchange=renderProducts;
  $("memberBtn").onclick=()=>{openModal("memberModal");renderMember()};
  $("memberClose").onclick=()=>closeModal("memberModal");
  $("loginTab").onclick=()=>tab("login");
  $("signupTab").onclick=()=>tab("signup");
  $("signupBtn").onclick=signup;
  $("loginBtn").onclick=login;
  $("logoutBtn").onclick=()=>signOut(auth);
  document.querySelectorAll(".modal").forEach(m=>{
    m.addEventListener("click",(e)=>{if(e.target===m) closeModal(m.id)});
  });
  document.addEventListener("keydown",(e)=>{if(e.key==="Escape") document.querySelectorAll(".modal.show").forEach(m=>closeModal(m.id))});
}
let loadingAll=false;
async function loadAll(){if(loadingAll)return; loadingAll=true; try{let notices=await list("notices",defaults.notices), prices=await list("consultPrices",defaults.prices), reviews=(await list("reviews",defaults.reviews)).filter(r=>r.approved), posts=await list("posts",defaults.posts); products=await list("products",defaults.products); let settings=await list("settings",[]); payment=settings.find(s=>s.id=="payment")||{name:"천율도령",account:"02002407816",guide:"송금 후 주문 신청"}; let t=settings.find(s=>s.id=="bookingTimes"); if(t) booking={times:t.times||booking.times,blockedDates:t.blockedDates||[]}; let b=settings.find(s=>s.id=="business")||{}; Object.entries({bizFooterName:b.footerName||"천율도령 공식 신점 상담",bizName:b.name||"천율도령",bizOwner:b.owner||"정세진",bizNumber:b.number||"570-76-00713",bizAddress:b.address||"경상북도 구미시 상모로12길 49, 101동 102호",bizType:b.type||"협회 및 단체, 수리 및 기타 개인서비스업",bizItem:b.item||"점술 및 유사 서비스업",bizContact:b.contact||"카카오톡 오픈프로필 '천율도령'",bizMailOrder:b.mailOrder||"신고 예정"}).forEach(([id,v])=>{if($(id))$(id).textContent=v});$("noticeList").innerHTML=notices.map(n=>`<article class="card"><span class="badge">${esc(n.tag)}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join("");$("priceList").innerHTML=prices.map(p=>`<article class="card"><span class="badge">${esc(p.badge||"상담")}</span><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p><strong class="price">${esc(p.price)}</strong><button class="btn gold full addConsult" data-name="${esc(p.title)}" data-price="${esc(p.price)}">담기</button></article>`).join("");$("bookType").innerHTML=prices.map(p=>`<option>${esc(p.title)} ${esc(p.price)}</option>`).join("");document.querySelectorAll(".addConsult").forEach(btn=>btn.onclick=()=>addCart({id:"consult-"+btn.dataset.name,name:btn.dataset.name,price:btn.dataset.price,qty:1}));renderTimes();renderProducts();$("reviewList").innerHTML=(reviews.length?reviews:[{name:"안내",category:"후기",stars:"★★★★★",body:"승인된 후기가 표시됩니다.",images:[]}]).map(r=>`<article class="card">${gallery(r.images||[])}<strong class="price">${esc(r.stars)}</strong><p>${esc(r.body)}</p><span>${esc(r.name)} · ${esc(r.category)}</span></article>`).join("");$("postList").innerHTML=posts.map(p=>`<article class="card">${gallery(p.images||[])}<h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`).join("");saveCart()}finally{loadingAll=false}}
function renderProducts(){let q=$("searchInput").value.toLowerCase(),c=$("categorySelect").value;let cats=[...new Set(products.map(p=>p.category).filter(Boolean))];$("categorySelect").innerHTML=`<option value="">전체</option>`+cats.map(x=>`<option ${x==c?"selected":""}>${x}</option>`).join("");let rows=products.filter(p=>(!c||p.category==c)&&(!q||`${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q)));$("productList").innerHTML=rows.map(p=>`<article class="product">${gallery(p.images||[])}<span class="badge">${esc(p.stock||"주문 가능")}</span><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p><strong class="price">${esc(p.sale||p.price)}</strong><button class="btn gold full addProduct" data-id="${p.id}">담기</button></article>`).join("");document.querySelectorAll(".addProduct").forEach(btn=>btn.onclick=()=>{let p=products.find(x=>x.id==btn.dataset.id);addCart({id:p.id,name:p.name,price:p.sale||p.price,qty:1})})}
function addCart(item){let f=cart.find(x=>x.id==item.id);f?f.qty++:cart.push(item);saveCart();alert("담았습니다.")}
function openCart(){fillForms();renderCart();renderPayment();openModal("cartModal")}function renderCart(){$("cartItems").innerHTML=cart.map((i,k)=>`<div class="cartItem"><div><b>${esc(i.name)}</b><p>${esc(i.price)} × ${i.qty}</p></div><button class="cartRemove" data-i="${k}">삭제</button></div>`).join("")||"<p>비어 있습니다.</p>";document.querySelectorAll(".cartRemove").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.i,1);saveCart();renderCart()});$("subTotal").textContent=won(sub());$("discountTotal").textContent=won(couponDiscount);$("finalTotal").textContent=won(total());$("couponText").textContent=coupon?`${coupon.code} / ${won(couponDiscount)} 할인`:"적용된 쿠폰이 없습니다."}
function renderPayment(){let p=payment;$("paymentInfo").innerHTML=`<div class="payGrid"><article class="payCard"><div class="payTitle">카카오페이</div><div class="payNumber">${esc(p.account||"02002407816")}</div>${p.link?`<a class="btn gold full" target="_blank" href="${p.link}">카카오페이 송금하기</a>`:""}<button class="btn line full copyBtn" data-copy="${esc(p.account||"02002407816")}">카카오페이 번호 복사</button></article>${p.bankAccount?`<article class="payCard"><div class="payTitle">계좌이체</div><div class="payNumber">${esc(p.bankName)} ${esc(p.bankAccount)}</div><p>예금주: ${esc(p.bankOwner)}</p><button class="btn line full copyBtn" data-copy="${esc(p.bankAccount)}">계좌번호 복사</button></article>`:""}</div><p class="hint">${esc(p.guide||"송금 후 주문 신청")}</p>`;document.querySelectorAll(".copyBtn").forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.copy);alert("복사되었습니다.")})}
async function applyCoupon(){let code=$("couponInput").value.trim().toUpperCase();if(!code)return alert("쿠폰 코드를 입력하세요.");let coupons=await list("coupons",[]),c=coupons.find(x=>(x.code||"").toUpperCase()==code);if(!c)return alert("등록되지 않은 쿠폰입니다.");if(c.used)return alert("이미 사용된 쿠폰입니다.");if(c.memberUid||c.memberEmail){if(!currentMember)return alert("회원 전용 쿠폰입니다.");let uid=currentMember.uid||currentMember.id;if(c.memberUid&&c.memberUid!=uid)return alert("해당 회원 쿠폰입니다.");if(c.memberEmail&&c.memberEmail!=currentMember.email)return alert("해당 회원 쿠폰입니다.")}coupon=c;couponDiscount=money(c.discount);renderCart();alert("쿠폰 적용 완료")}
function orderNo(){return "CY"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+Math.random().toString(36).slice(2,7).toUpperCase()}
async function order(){if(!cart.length)return alert("장바구니가 비었습니다.");if(!$("orderName").value||!$("orderContact").value)return alert("주문자 정보를 입력하세요.");let no=orderNo();await addDoc(collection(db,"orders"),{orderNo:no,items:cart,subtotal:won(sub()),discount:couponDiscount,coupon:coupon?.code||"",total:won(total()),name:$("orderName").value,contact:$("orderContact").value,address:$("orderAddress").value,memo:$("orderMemo").value,memberUid:currentMember?.uid||currentMember?.id||"",memberEmail:currentMember?.email||"",status:"입금대기",payment:"카카오페이/계좌이체",createdAt:serverTimestamp()});if(coupon?.id)try{await updateDoc(doc(db,"coupons",coupon.id),{used:true,usedAt:serverTimestamp()})}catch(e){}cart=[];coupon=null;couponDiscount=0;saveCart();closeModal("cartModal");alert("주문 완료\n주문번호: "+no)}
function renderTimes(){let d=$("bookDate").value,blocked=booking.blockedDates.includes(d);$("bookTime").innerHTML=blocked?"<option>예약 마감</option>":booking.times.map(t=>`<option>${t}</option>`).join("");$("bookMsg").textContent=blocked?"해당 날짜는 예약 마감입니다.":""}
async function book(){if(!$("bookName").value||!$("bookContact").value||!$("bookDate").value)return alert("예약 정보를 입력하세요.");await addDoc(collection(db,"bookings"),{name:$("bookName").value,contact:$("bookContact").value,type:$("bookType").value,date:$("bookDate").value,time:$("bookTime").value,body:$("bookBody").value,memberUid:currentMember?.uid||currentMember?.id||"",memberEmail:currentMember?.email||"",status:"대기",createdAt:serverTimestamp()});alert("예약 신청 완료")}
async function track(){let no=$("trackNo").value.trim(),ct=$("trackContact").value.trim(),orders=await list("orders",[]),o=orders.find(x=>x.orderNo==no&&x.contact==ct);$("trackResult").innerHTML=o?`<article class="card"><h3>${o.orderNo}</h3><p>상태: ${o.status}</p><p>배송: ${o.trackingCompany||"등록 전"} ${o.trackingNo||""}</p></article>`:"<article class='card'>주문을 찾지 못했습니다.</article>"}
async function uploadFiles(fs,folder){let urls=[];for(let f of Array.from(fs||[])){let r=ref(storage,`${folder}/${Date.now()}_${f.name}`);await uploadBytes(r,f);urls.push(await getDownloadURL(r))}return urls}
async function review(){let imgs=await uploadFiles($("reviewImages").files,"reviews");await addDoc(collection(db,"reviews"),{name:$("reviewName").value,category:$("reviewCategory").value,stars:$("reviewStars").value,body:$("reviewBody").value,images:imgs,approved:false,createdAt:serverTimestamp()});closeModal("reviewModal");alert("후기 등록 요청 완료")}
function tab(m){$("loginPanel").classList.toggle("hide",m!="login");$("signupPanel").classList.toggle("hide",m!="signup");$("loginTab").classList.toggle("active",m=="login");$("signupTab").classList.toggle("active",m=="signup")}
async function signup(){
  let name=$("signupName").value.trim(),contact=$("signupContact").value.trim(),email=$("signupEmail").value.trim(),pw=$("signupPw").value;
  if(!name||!contact||!email||pw.length<6)return alert("회원가입 정보를 확인하세요. 비밀번호는 6자리 이상입니다.");
  try{
    let cr=await createUserWithEmailAndPassword(auth,email,pw);
    await setDoc(doc(db,"members",cr.user.uid),{uid:cr.user.uid,name,contact,email,createdAt:serverTimestamp()},{merge:true});
    alert("회원가입이 완료되었습니다.");
    closeModal("memberModal");
  }catch(e){
    if(e.code==="auth/email-already-in-use") alert("이미 가입된 이메일입니다. 로그인 탭에서 로그인해 주세요.");
    else alert("회원가입 실패: "+(e.message||e));
  }
}
async function login(){
  try{
    await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPw").value);
    alert("로그인되었습니다.");
    closeModal("memberModal");
  }catch(e){
    alert("로그인 실패: 이메일 또는 비밀번호를 확인해 주세요.");
  }
}
async function loadMember(user){if(!user){currentMember=null;renderMember();return}let ms=await list("members",[]),m=ms.find(x=>x.id==user.uid)||{uid:user.uid,email:user.email};currentMember=m;renderMember();fillForms()}
function renderMember(){let logged=!!currentMember;$("guestPanels").classList.toggle("hide",logged);$("memberPanel").classList.toggle("hide",!logged);$("memberBtn").textContent=logged?"내 정보":"로그인/회원가입";if(logged){$("memberInfo").innerHTML=`이름: <b>${esc(currentMember.name)}</b><br>연락처: ${esc(currentMember.contact)}<br>이메일: ${esc(currentMember.email)}`;loadMyCoupons()}}
async function loadMyCoupons(){let cs=await list("coupons",[]),uid=currentMember.uid||currentMember.id,my=cs.filter(c=>c.memberUid==uid||c.memberEmail==currentMember.email);$("myCoupons").innerHTML=my.length?my.map(c=>`<div class="myCoupon ${c.used?"used":""}"><b>${c.code}</b><p>${won(money(c.discount))} 할인 / ${c.used?"사용완료":"사용가능"}</p>${!c.used?`<button class="btn line full useCoupon" data-code="${c.code}">이 쿠폰 사용</button>`:""}</div>`).join(""):"<p class='hint'>발급된 쿠폰이 없습니다.</p>";document.querySelectorAll(".useCoupon").forEach(b=>b.onclick=()=>{$("couponInput").value=b.dataset.code;closeModal("memberModal");openCart()})}
function fillForms(){if(!currentMember)return;[["orderName",currentMember.name],["orderContact",currentMember.contact],["bookName",currentMember.name],["bookContact",currentMember.contact]].forEach(([id,v])=>{if($(id)&&!$(id).value)$(id).value=v||""})}

function openModal(id){ const el=$(id); if(el){el.classList.add("show"); document.body.classList.add("modalOpen");}}
function closeModal(id){ const el=$(id); if(el){el.classList.remove("show");} if(!document.querySelector(".modal.show")) document.body.classList.remove("modalOpen");}
function startRealtimeSync(){
  ["products","consultPrices","notices","posts","reviews","settings","coupons","orders","bookings"].forEach(col=>{
    try{onSnapshot(collection(db,col),()=>loadAll());}catch(e){console.warn("sync",col,e)}
  });
}


async function loadMyHistory(){
  const box=$("myHistory"); if(!box) return;
  if(!currentMember){box.innerHTML="<p class='hint'>로그인 후 확인 가능합니다.</p>"; return;}
  let uid=currentMember.uid||currentMember.id, [orders, bookings]=await Promise.all([list("orders",[]),list("bookings",[])]);
  let myOrders=orders.filter(o=>o.memberUid===uid||o.memberEmail===currentMember.email||o.contact===currentMember.contact);
  let myBooks=bookings.filter(b=>b.memberUid===uid||b.memberEmail===currentMember.email||b.contact===currentMember.contact);
  box.innerHTML = `
    <h4>주문</h4>${myOrders.length?myOrders.map(o=>`<div class="myCoupon"><b>${o.orderNo||o.id}</b><p>${o.total||""} / ${o.status||""}</p>${!String(o.status||"").includes("취소")?`<button class="btn line full cancelOrderBtn" data-id="${o.id}">상품 주문 취소 요청</button>`:""}</div>`).join(""):"<p class='hint'>주문 내역이 없습니다.</p>"}
    <h4>예약</h4>${myBooks.length?myBooks.map(b=>`<div class="myCoupon"><b>${b.type||"상담 예약"}</b><p>${b.date||""} ${b.time||""} / ${b.status||""}</p>${!String(b.status||"").includes("취소")?`<button class="btn line full cancelBookBtn" data-id="${b.id}">상담 예약 취소 요청</button>`:""}</div>`).join(""):"<p class='hint'>예약 내역이 없습니다.</p>"}
  `;
  document.querySelectorAll(".cancelOrderBtn").forEach(btn=>btn.onclick=()=>requestCancel("orders",btn.dataset.id));
  document.querySelectorAll(".cancelBookBtn").forEach(btn=>btn.onclick=()=>requestCancel("bookings",btn.dataset.id));
}
async function requestCancel(col,id){
  const reason=prompt("취소 사유를 입력해 주세요.");
  if(reason===null) return;
  await updateDoc(doc(db,col,id),{status:"취소요청",cancelReason:reason||"고객 요청",cancelRequestedAt:serverTimestamp()});
  alert("취소 요청이 접수되었습니다.");
  loadMyHistory();
}

init();