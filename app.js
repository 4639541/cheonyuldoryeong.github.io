import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const $ = (id) => document.getElementById(id);

let products = [];
let payment = {};
let coupon = null;
let couponDiscount = 0;
let cart = JSON.parse(localStorage.getItem("cyCart") || "[]");
let currentMember = null;
let bookingSettings = {times:["오전","오후","저녁","상담 후 조율"], blockedDates:[]};

const defaults = {
  notices:[{tag:"필독",title:"상담은 예약제로 진행됩니다.",body:"예약 신청 후 카카오톡으로 순차 안내드립니다."}],
  prices:[
    {title:"한 질문 상담",price:"20,000원",badge:"기본",desc:"하나의 핵심 질문을 중심으로 흐름을 봅니다."},
    {title:"세 질문 상담",price:"50,000원",badge:"추천",desc:"연결된 고민 세 가지를 묶어 정리합니다."},
    {title:"궁합 상담",price:"80,000원",badge:"관계",desc:"두 사람의 관계 흐름과 방향을 살펴봅니다."},
    {title:"심층 신점 상담",price:"120,000원",badge:"심층",desc:"전반적인 흐름을 깊이 있게 살펴봅니다."}
  ],
  products:[{id:"demo",name:"상담 예약 상품",category:"상담",price:"20,000원",stock:"예약 가능",desc:"관리자에서 상품을 등록하면 이 영역에 표시됩니다.",images:[]}],
  reviews:[{name:"상담 후기",category:"신점 상담",stars:"★★★★★",body:"관리자 승인 후 후기가 공개됩니다.",images:[]}],
  posts:[{title:"게시판 안내",body:"관리자에서 이미지와 글을 등록할 수 있습니다.",images:[]}]
};

function esc(v){return String(v ?? "");}
function moneyNumber(v){return Number(String(v || "").replace(/[^\d]/g,"")) || 0;}
function formatWon(n){return (Number(n)||0).toLocaleString()+"원";}
function subtotal(){return cart.reduce((sum,i)=>sum + moneyNumber(i.price) * Number(i.qty||1), 0);}
function finalTotal(){return Math.max(0, subtotal() - couponDiscount);}
function saveCart(){localStorage.setItem("cyCart", JSON.stringify(cart)); if($("cartCount")) $("cartCount").textContent = cart.reduce((a,b)=>a+Number(b.qty||1),0);}
function gallery(images=[]){return images?.length ? `<div class="gallery">${images.map(src=>`<img src="${src}" alt="">`).join("")}</div>` : "";}

async function list(col, fallback=[]){
  try{
    const snap = await getDocs(collection(db,col));
    const arr = snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    return arr.length ? arr : fallback;
  }catch(e){
    console.warn(col, e);
    return fallback;
  }
}

async function init(){
  $("menuBtn")?.addEventListener("click", () => $("nav")?.classList.toggle("show"));
  bindUI();
  bindMemberUI();

  const notices = await list("notices", defaults.notices);
  $("noticeList").innerHTML = notices.map(n=>`<article class="card"><span class="badge">${esc(n.tag||"공지")}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join("");

  const prices = await list("consultPrices", defaults.prices);
  $("priceList").innerHTML = prices.map(p=>`<article class="card"><span class="badge">${esc(p.badge||"상담")}</span><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p><strong class="price">${esc(p.price||"문의")}</strong><a class="btn gold full" href="#booking">예약하기</a></article>`).join("");
  $("bookType").innerHTML = prices.map(p=>`<option>${esc(p.title)} ${esc(p.price)}</option>`).join("");

  products = await list("products", defaults.products);
  renderCategories();
  renderProducts();

  payment = await getPayment();
  bookingSettings = await getBookingSettings();
  setupBookingCalendar();

  const reviews = (await list("reviews", defaults.reviews)).filter(r=>r.approved === true);
  $("reviewList").innerHTML = (reviews.length ? reviews : defaults.reviews)
    .map(r=>`<article class="card">${gallery(r.images || (r.image?[r.image]:[]))}<strong class="price">${esc(r.stars || "★★★★★")}</strong><p>“${esc(r.body)}”</p><span>${esc(r.name)} · ${esc(r.category)}</span></article>`).join("");

  const posts = await list("posts", defaults.posts);
  $("postList").innerHTML = posts.map(p=>`<article class="card">${gallery(p.images||[])}<h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`).join("");

  await loadBusinessInfo();
  saveCart();
}
function bindUI(){
  $("searchInput")?.addEventListener("input", renderProducts);
  $("categorySelect")?.addEventListener("change", renderProducts);
  $("cartOpenBtn")?.addEventListener("click", openCart);
  $("cartCloseBtn")?.addEventListener("click", ()=>$("cartModal").classList.remove("show"));
  $("orderBtn")?.addEventListener("click", submitOrder);
  $("couponBtn")?.addEventListener("click", applyCoupon);
  $("bookingBtn")?.addEventListener("click", submitBooking);
  $("bookDate")?.addEventListener("change", updateAvailableTimes);
  $("reviewOpenBtn")?.addEventListener("click", ()=>$("reviewModal").classList.add("show"));
  $("reviewCloseBtn")?.addEventListener("click", ()=>$("reviewModal").classList.remove("show"));
  $("reviewSubmitBtn")?.addEventListener("click", submitReview);
  $("trackBtn")?.addEventListener("click", trackOrder);
}
function renderCategories(){
  const cats = [...new Set(products.map(p=>p.category).filter(Boolean))];
  $("categorySelect").innerHTML = `<option value="">전체 카테고리</option>` + cats.map(c=>`<option>${esc(c)}</option>`).join("");
}
function renderProducts(){
  const q = $("searchInput").value.toLowerCase();
  const c = $("categorySelect").value;
  const rows = products.filter(p => (!c || p.category === c) && (!q || `${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q)));
  $("productList").innerHTML = rows.map(p=>{
    const soldout = String(p.stock||"").includes("품절") || String(p.stock||"") === "0개";
    return `<article class="product ${soldout?"soldout":""}">${gallery(p.images||[])}<span class="badge">${esc(p.stock||"주문 가능")}</span><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>${p.sale?`<p class="hint"><s>${esc(p.price)}</s></p><strong class="price">${esc(p.sale)}</strong>`:`<strong class="price">${esc(p.price||"문의")}</strong>`}<button class="btn gold full addCart" data-id="${p.id}" ${soldout?"disabled":""}>${soldout?"품절":"장바구니"}</button></article>`;
  }).join("") || `<article class="card">상품이 없습니다.</article>`;
  document.querySelectorAll(".addCart").forEach(btn=>btn.addEventListener("click",()=>addCart(btn.dataset.id)));
}
function addCart(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  if(String(p.stock||"").includes("품절")) return alert("품절 상품입니다.");
  const found = cart.find(x=>x.id===id);
  if(found) found.qty += 1;
  else cart.push({id:p.id,name:p.name,price:p.sale||p.price,qty:1});
  saveCart();
  alert("장바구니에 담았습니다.");
}
function openCart(){fillMemberToForms(); renderCart(); renderPayment(); $("cartModal").classList.add("show");}



function orderNo(){
  const d = new Date();
  const date = d.toISOString().slice(2,10).replaceAll("-","");
  return `CY${date}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}


async function decreaseStock(){
  for(const item of cart){
    const p = products.find(x=>x.id===item.id);
    const n = parseInt(String(p?.stock||"").replace(/[^\d]/g,""),10);
    if(Number.isFinite(n)){
      const next = Math.max(0,n-Number(item.qty||1));
      try{await updateDoc(doc(db,"products",p.id),{stock: next<=0 ? "품절" : `${next}개`});}catch(e){}
    }
  }
}
async function getBookingSettings(){
  const settings = await list("settings", []);
  const t = settings.find(s=>s.id==="bookingTimes");
  return {
    times: Array.isArray(t?.times) && t.times.length ? t.times : ["오전","오후","저녁","상담 후 조율"],
    blockedDates: Array.isArray(t?.blockedDates) ? t.blockedDates : []
  };
}
function setupBookingCalendar(){
  const dateEl = $("bookDate");
  if(dateEl) dateEl.min = new Date().toISOString().slice(0,10);
  updateAvailableTimes();
}
function updateAvailableTimes(){
  const date = $("bookDate")?.value || "";
  const blocked = bookingSettings.blockedDates.includes(date);
  $("bookTime").innerHTML = blocked 
    ? `<option>예약 마감</option>` 
    : bookingSettings.times.map(t=>`<option>${esc(t)}</option>`).join("");
  if($("bookedNotice")) $("bookedNotice").textContent = blocked ? "해당 날짜는 예약이 마감되었습니다." : "";
}
async function submitBooking(){
  if(!$("bookName").value || !$("bookContact").value) return alert("이름과 연락처를 입력해 주세요.");
  if(!$("bookDate").value) return alert("상담 희망 날짜를 선택해 주세요.");
  if(bookingSettings.blockedDates.includes($("bookDate").value)) return alert("해당 날짜는 예약이 마감되었습니다.");
  await addDoc(collection(db,"bookings"),{
    name:$("bookName").value,
    contact:$("bookContact").value,
    type:$("bookType").value,
    date:$("bookDate").value,
    time:$("bookTime").value,
    body:$("bookBody").value,
    memberUid: currentMember?.uid || currentMember?.id || "",
    memberEmail: currentMember?.email || "",
    status:"대기",
    createdAt:serverTimestamp()
  });
  alert("예약 신청이 접수되었습니다.");
}
async function optimizeImage(file,max=1600,quality=.82){
  if(!file || !file.type.startsWith("image/")) return file;
  const img = await new Promise((resolve,reject)=>{
    const i=new Image();
    i.onload=()=>resolve(i); i.onerror=reject;
    i.src=URL.createObjectURL(file);
  });
  const scale = Math.min(1, max / Math.max(img.width,img.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(img.width*scale);
  canvas.height=Math.round(img.height*scale);
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
  return new File([blob], file.name.replace(/\.[^.]+$/,"")+".jpg", {type:"image/jpeg"});
}
async function uploadFiles(fileList,folder){
  const urls=[];
  for(const f of Array.from(fileList||[])){
    const file = await optimizeImage(f);
    const r = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(r,file);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
async function submitReview(){
  if(!$("reviewName").value || !$("reviewBody").value) return alert("이름과 후기 내용을 입력해 주세요.");
  const images = await uploadFiles($("reviewImages").files, "reviews");
  await addDoc(collection(db,"reviews"),{
    name:$("reviewName").value,
    category:$("reviewCategory").value,
    stars:$("reviewStars").value,
    body:$("reviewBody").value,
    images,
    image:images[0]||"",
    approved:false,
    createdAt:serverTimestamp()
  });
  $("reviewModal").classList.remove("show");
  alert("후기 등록 요청이 완료되었습니다.");
}






async function getPayment(){
  try{
    const snap = await getDocs(collection(db,"settings"));
    let found = null;
    snap.docs.forEach(d=>{
      if(d.id === "payment") found = {id:d.id, ...d.data()};
    });
    return found || {
      name:"천율도령",
      account:"02002407816",
      link:"",
      bankName:"",
      bankOwner:"",
      bankAccount:"",
      guide:"송금 후 주문 신청을 눌러주세요."
    };
  }catch(e){
    console.warn("결제 정보 불러오기 실패", e);
    return {name:"천율도령",account:"02002407816",guide:"송금 후 주문 신청을 눌러주세요."};
  }
}









function renderCart(){
  const itemsBox = document.getElementById("cartItems");
  if(!itemsBox) return;
  itemsBox.innerHTML = cart.map((i,idx)=>`
    <div class="cartItem">
      <div>
        <b>${esc(i.name)}</b>
        <p>${esc(i.price)} × ${i.qty}</p>
      </div>
      <button class="cartRemove" data-i="${idx}" type="button">삭제</button>
    </div>
  `).join("") || `<div class="card">장바구니가 비어 있습니다.</div>`;

  document.querySelectorAll(".cartRemove").forEach(btn=>{
    btn.onclick = ()=>{
      cart.splice(Number(btn.dataset.i),1);
      saveCart();
      renderCart();
    };
  });

  const sub = subtotal();
  const total = finalTotal();
  const subEl = document.getElementById("cartSubtotal");
  const disEl = document.getElementById("cartDiscount");
  const totalEl = document.getElementById("cartTotal");
  const couponText = document.getElementById("couponAppliedText");

  if(subEl) subEl.textContent = formatWon(sub);
  if(disEl) disEl.textContent = formatWon(couponDiscount);
  if(totalEl) totalEl.textContent = formatWon(total);
  if(couponText) couponText.textContent = coupon ? `${coupon.code} / ${formatWon(couponDiscount)} 할인` : "적용된 쿠폰이 없습니다.";
}

function renderPayment(){
  const box = document.getElementById("paymentInfo");
  if(!box) return;

  const p = payment || {};
  const kakaoNo = p.account || "020-02-407816";
  const bankNo = p.bankAccount || "";

  box.innerHTML = `
    <div class="payGrid">
      <article class="payCard">
        <div class="payTitle">카카오페이</div>
        <div class="payName">${p.name || "천율도령"}</div>
        <div class="payNumber">${kakaoNo}</div>
        <div class="payActions">
          ${p.link ? `<a class="btn gold full" target="_blank" href="${p.link}">카카오페이 송금하기</a>` : ""}
          <button class="btn line full payCopyBtn" type="button" data-copy="${kakaoNo}" data-label="카카오페이 번호">카카오페이 번호 복사</button>
        </div>
      </article>

      ${bankNo ? `
      <article class="payCard">
        <div class="payTitle">계좌이체</div>
        <div class="payName">${p.bankName || ""}</div>
        <div class="payNumber">${bankNo}</div>
        <div class="payOwner">예금주: ${p.bankOwner || ""}</div>
        <button class="btn line full payCopyBtn" type="button" data-copy="${bankNo}" data-label="계좌번호">계좌번호 복사</button>
      </article>` : ""}
    </div>
    ${p.qr ? `<img class="payQr" src="${p.qr}" alt="카카오페이 QR">` : ""}
    <p class="hint">${p.guide || "송금 후 주문 신청을 눌러주세요."}</p>
  `;

  document.querySelectorAll(".payCopyBtn").forEach(btn=>{
    btn.onclick = async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const text = btn.dataset.copy || "";
      const label = btn.dataset.label || "번호";
      if(!text) return alert(`복사할 ${label}가 없습니다.`);
      try{
        await navigator.clipboard.writeText(text);
      }catch(err){
        const t = document.createElement("textarea");
        t.value = text;
        t.style.position = "fixed";
        t.style.left = "-9999px";
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        document.body.removeChild(t);
      }
      alert(`${label}가 복사되었습니다.`);
    };
  });
}

async function applyCoupon(){
  const code = document.getElementById("couponInput")?.value.trim().toUpperCase();
  if(!code) return alert("쿠폰 코드를 입력해 주세요.");

  const coupons = await list("coupons", []);
  const c = coupons.find(x => (x.code || "").toUpperCase() === code);
  if(!c) return alert("등록되지 않은 쿠폰 코드입니다.");
  if(c.used === true) return alert("이미 사용된 쿠폰입니다.");

  coupon = c;
  couponDiscount = moneyNumber(c.discount);

  if(couponDiscount <= 0) return alert("쿠폰 할인금액이 올바르지 않습니다.");

  alert(`쿠폰이 적용되었습니다.\n할인금액: ${formatWon(couponDiscount)}`);
  renderCart();
}

async function submitOrder(){
  if(!cart.length) return alert("장바구니가 비어 있습니다.");
  if(!document.getElementById("orderName").value || !document.getElementById("orderContact").value) return alert("주문자 이름과 연락처를 입력해 주세요.");

  const no = orderNo();
  await addDoc(collection(db,"orders"),{
    orderNo:no,
    items:cart,
    subtotal:formatWon(subtotal()),
    discount:couponDiscount,
    coupon:coupon?.code || "",
    total:formatWon(finalTotal()),
    name:document.getElementById("orderName").value,
    contact:document.getElementById("orderContact").value,
    address:document.getElementById("orderAddress").value,
    memo:document.getElementById("orderMemo").value,
    memberUid: currentMember?.uid || currentMember?.id || "",
    memberEmail: currentMember?.email || "",
    status:"입금대기",
    payment:"카카오페이/계좌이체",
    trackingCompany:"",
    trackingNo:"",
    createdAt:serverTimestamp()
  });

  if(coupon?.id){
    try{await updateDoc(doc(db,"coupons",coupon.id),{used:true,usedAt:serverTimestamp()});}catch(e){}
  }
  await decreaseStock();

  cart=[]; coupon=null; couponDiscount=0;
  saveCart();
  document.getElementById("cartModal").classList.remove("show");
  alert(`주문 신청 완료\n주문번호: ${no}`);
}


function memberVal(id){return document.getElementById(id)?.value?.trim() || "";}
function setMemberText(){
  const btn = document.getElementById("memberOpenBtn");
  if(btn) btn.textContent = currentMember ? "내 정보" : "로그인/회원가입";
}
function openMemberModal(){
  document.getElementById("memberModal")?.classList.add("show");
  renderMemberPanel();
}
function closeMemberModal(){
  document.getElementById("memberModal")?.classList.remove("show");
}
function showMemberTab(mode){
  document.getElementById("loginPanel")?.classList.toggle("hidden", mode !== "login");
  document.getElementById("signupPanel")?.classList.toggle("hidden", mode !== "signup");
  document.getElementById("loginTabBtn")?.classList.toggle("active", mode === "login");
  document.getElementById("signupTabBtn")?.classList.toggle("active", mode === "signup");
}
function renderMemberPanel(){
  const logged = !!currentMember;
  document.getElementById("memberInfoPanel")?.classList.toggle("hidden", !logged);
  document.getElementById("loginPanel")?.classList.toggle("hidden", logged);
  document.getElementById("signupPanel")?.classList.add("hidden");
  document.getElementById("loginTabBtn")?.classList.toggle("hidden", logged);
  document.getElementById("signupTabBtn")?.classList.toggle("hidden", logged);

  if(logged){
    const text = document.getElementById("memberInfoText");
    if(text) text.innerHTML = `이름: <b>${currentMember.name || ""}</b><br>연락처: ${currentMember.contact || ""}<br>이메일: ${currentMember.email || ""}`;
  }else{
    showMemberTab("login");
  }
  setMemberText();
}
function fillMemberToForms(){
  if(!currentMember) return;
  const pairs = [
    ["orderName", currentMember.name],
    ["orderContact", currentMember.contact],
    ["bookName", currentMember.name],
    ["bookContact", currentMember.contact]
  ];
  pairs.forEach(([id,v])=>{
    const el = document.getElementById(id);
    if(el && !el.value) el.value = v || "";
  });
}
async function signupMember(){
  const name = memberVal("signupName");
  const contact = memberVal("signupContact");
  const email = memberVal("signupEmail");
  const pw = memberVal("signupPassword");
  if(!name || !contact || !email || !pw) return alert("회원가입 정보를 모두 입력해 주세요.");
  if(pw.length < 6) return alert("비밀번호는 6자리 이상 입력해 주세요.");
  const cred = await createUserWithEmailAndPassword(auth, email, pw);
  await setDoc(doc(db,"members",cred.user.uid),{
    uid:cred.user.uid,
    name,
    contact,
    email,
    role:"member",
    createdAt:serverTimestamp()
  },{merge:true});
  alert("회원가입이 완료되었습니다.");
}
async function loginMember(){
  const email = memberVal("loginEmail");
  const pw = memberVal("loginPassword");
  if(!email || !pw) return alert("이메일과 비밀번호를 입력해 주세요.");
  await signInWithEmailAndPassword(auth, email, pw);
  alert("로그인되었습니다.");
}
async function logoutMember(){
  await signOut(auth);
  alert("로그아웃되었습니다.");
}
async function loadMemberProfile(user){
  if(!user){
    currentMember = null;
    setMemberText();
    renderMemberPanel();
    return;
  }
  try{
    const snap = await getDocs(collection(db,"members"));
    const found = snap.docs.find(d=>d.id === user.uid);
    currentMember = found ? {id:found.id,...found.data()} : {uid:user.uid,email:user.email,name:"",contact:""};
  }catch(e){
    currentMember = {uid:user.uid,email:user.email,name:"",contact:""};
  }
  setMemberText();
  fillMemberToForms();
  renderMemberPanel();
}
function bindMemberUI(){
  document.getElementById("memberOpenBtn")?.addEventListener("click", openMemberModal);
  document.getElementById("memberCloseBtn")?.addEventListener("click", closeMemberModal);
  document.getElementById("loginTabBtn")?.addEventListener("click", ()=>showMemberTab("login"));
  document.getElementById("signupTabBtn")?.addEventListener("click", ()=>showMemberTab("signup"));
  document.getElementById("signupMemberBtn")?.addEventListener("click", async()=>{try{await signupMember();}catch(e){alert("회원가입 실패: "+e.message);}});
  document.getElementById("loginMemberBtn")?.addEventListener("click", async()=>{try{await loginMember();}catch(e){alert("로그인 실패: 이메일 또는 비밀번호를 확인해 주세요.");}});
  document.getElementById("logoutMemberBtn")?.addEventListener("click", logoutMember);
  onAuthStateChanged(auth, loadMemberProfile);
}

init();


async function loadBusinessInfo(){
  try{
    const settings = await list("settings", []);
    const biz = settings.find(s=>s.id==="business") || {};
    const data = {
      bizFooterName: biz.footerName || "천율도령 공식 신점 상담",
      bizName: biz.name || "천율도령",
      bizOwner: biz.owner || "정세진",
      bizNumber: biz.number || "570-76-00713",
      bizAddress: biz.address || "경상북도 구미시 상모로12길 49, 101동 102호",
      bizType: biz.type || "협회 및 단체, 수리 및 기타 개인서비스업",
      bizItem: biz.item || "점술 및 유사 서비스업",
      bizContact: biz.contact || "카카오톡 오픈프로필 '천율도령'",
      bizMailOrder: biz.mailOrder || "신고 예정"
    };
    for(const [id,value] of Object.entries(data)){
      const el = document.getElementById(id);
      if(el) el.textContent = value;
    }
  }catch(e){
    console.warn("사업자 정보 불러오기 실패", e);
  }
}

async function trackOrder(){
  const no = document.getElementById("trackOrderNo")?.value?.trim();
  const contact = document.getElementById("trackContact")?.value?.trim();
  const box = document.getElementById("trackingResult");
  if(!no || !contact) return alert("주문번호와 연락처를 입력해 주세요.");
  const orders = await list("orders", []);
  const found = orders.find(o => String(o.orderNo||"").trim() === no && String(o.contact||"").trim() === contact);
  if(!found){
    box.innerHTML = `<div class="card">일치하는 주문을 찾지 못했습니다.<br>주문번호와 연락처를 다시 확인해 주세요.</div>`;
    return;
  }
  box.innerHTML = `<div class="card">
    <h3>주문번호 ${found.orderNo||found.id}</h3>
    <p>주문자 : ${found.name||""}</p>
    <p>주문상태 : <b>${found.status||"입금대기"}</b></p>
    <p>배송방법/택배사 : ${found.trackingCompany||"등록 전"}</p>
    <p>송장번호/배송메모 : ${found.trackingNo||"등록 전"}</p>
    <p>총 결제금액 : ${found.total||""}</p>
  </div>`;
}

setTimeout(()=>{
  loadBusinessInfo();
  document.getElementById("trackBtn")?.addEventListener("click", trackOrder);
}, 300);
