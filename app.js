import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let products = [];
let paymentInfo = null;
let couponDiscount = 0;
let couponInfo = null;
let cart = JSON.parse(localStorage.getItem("cheonyulCart") || "[]");

const defaults = {
  consults:[
    {title:"한 질문 상담",price:"20,000원",badge:"기본",desc:"하나의 핵심 질문에 대해 현재 흐름과 방향을 살펴드립니다."},
    {title:"세 질문 상담",price:"50,000원",badge:"추천",desc:"연결된 고민 세 가지를 묶어 흐름을 정리합니다."},
    {title:"궁합 상담",price:"80,000원",badge:"관계",desc:"두 사람의 관계 흐름, 성향, 앞으로의 방향성을 함께 살펴드립니다."},
    {title:"심층 신점 상담",price:"120,000원",badge:"심층",desc:"전반적인 상황과 인생 흐름을 깊이 있게 살펴보는 상담입니다."}
  ],
  notices:[{tag:"필독",title:"상담은 예약제로 진행됩니다.",body:"카카오톡 문의 또는 홈페이지 예약 후 순서대로 안내드립니다."}],
  fields:[
    {title:"연애 · 재회",body:"상대방 속마음, 연락운, 재회 흐름, 관계 회복 가능성을 살펴봅니다."},
    {title:"금전운 · 사업운",body:"막힌 돈 흐름, 매출, 계약, 이동, 선택의 방향을 함께 봅니다."},
    {title:"취업 · 직장운",body:"취업, 이직, 시험, 승진, 직장 내 인간관계 흐름을 살펴봅니다."}
  ],
  products:[
    {id:"consult1",name:"한 질문 상담",category:"상담",price:"20,000원",sale:"",stock:"예약 가능",desc:"하나의 핵심 질문에 대해 현재 흐름과 방향을 살펴드립니다.",images:[]},
    {id:"consult2",name:"세 질문 상담",category:"상담",price:"50,000원",sale:"",stock:"예약 가능",desc:"연결된 고민 세 가지를 묶어 흐름을 정리합니다.",images:[]},
    {id:"consult3",name:"궁합 상담",category:"상담",price:"80,000원",sale:"",stock:"예약 가능",desc:"두 사람의 관계 흐름, 성향, 앞으로의 방향성을 함께 살펴드립니다.",images:[]},
    {id:"consult4",name:"심층 신점 상담",category:"상담",price:"120,000원",sale:"",stock:"예약 가능",desc:"전반적인 상황과 인생 흐름을 깊이 있게 살펴보는 상담입니다.",images:[]},
    {id:"demo1",name:"평안 염주",category:"염주",price:"25,000원",sale:"",stock:"주문 가능",desc:"마음의 평안과 좋은 흐름을 담은 염주입니다.",images:[]}
  ],
  reviews:[{name:"김OO님",category:"재회 상담",stars:"★★★★★",body:"혼자 복잡했던 마음이 정리되었습니다.",image:""}]
};

window.toggleMenu=()=>document.getElementById("navMenu").classList.toggle("show");

async function loadCollection(col, fallback=[]){
  try{
    const s=await getDocs(query(collection(db,col),orderBy("createdAt","desc")));
    const arr=s.docs.map(d=>({id:d.id,...d.data()}));
    return arr.length?arr:fallback;
  }catch(e){ return fallback; }
}
function firstImg(item){ return item.images?.[0] || item.image || ""; }
function wonNum(v){ return Number(String(v||"").replace(/[^\d]/g,"")) || 0; }
function saveCart(){ localStorage.setItem("cheonyulCart", JSON.stringify(cart)); updateCartCount(); }
function updateCartCount(){ document.getElementById("cartCount").textContent = cart.reduce((a,b)=>a+(Number(b.qty)||1),0); }

async function init(){
  const notices=await loadCollection("notices",defaults.notices);
  document.getElementById("noticeList").innerHTML=notices.map(n=>`<article><span class="badge">${n.tag||"공지"}</span><h3>${n.title||""}</h3><p>${n.body||""}</p></article>`).join("");

  const fields=await loadCollection("fields",defaults.fields);
  document.getElementById("fieldList").innerHTML=fields.map(f=>`<article><h3>${f.title||""}</h3><p>${f.body||""}</p></article>`).join("");

  const consults=await loadCollection("consultPrices",defaults.consults);
  const priceBox=document.getElementById("consultPriceList");
  if(priceBox){
    priceBox.innerHTML=consults.map(c=>`<article><span class="badge">${c.badge||"상담"}</span><h3>${c.title||""}</h3><p>${c.desc||""}</p><strong class="price">${c.price||"문의"}</strong><a class="btn primary" href="#booking">예약하기</a></article>`).join("");
  }
  const bookTypeEl=document.getElementById("bookType");
  if(bookTypeEl){
    bookTypeEl.innerHTML=consults.map(c=>`<option>${c.title||"상담"} ${c.price||""}</option>`).join("") + `<option>재회 상담</option><option>속마음 상담</option><option>금전운 상담</option><option>사업운 상담</option><option>취업운 상담</option><option>상품 문의</option>`;
  }

  products=await loadCollection("products",defaults.products);
  fillCategories();
  renderProducts();

  const posts=await loadCollection("posts",[]);
  document.getElementById("postList").innerHTML=posts.map(p=>`<article>${firstImg(p)?`<img class="postImg" src="${firstImg(p)}">`:""}<span class="badge">게시글</span><h3>${p.title||""}</h3><p>${p.body||""}</p></article>`).join("") || `<article><h3>등록된 게시글이 없습니다.</h3><p>관리자 페이지에서 게시글을 등록해 주세요.</p></article>`;

  const reviews=await loadApprovedReviews();
  document.getElementById("reviewList").innerHTML=reviews.map(r=>`<article>${r.image?`<img class="reviewImg" src="${r.image}">`:""}<div class="price">${r.stars||"★★★★★"}</div><p>“${r.body||""}”</p><span>${r.name||"익명"} · ${r.category||""}</span></article>`).join("");
  paymentInfo = await loadPaymentInfo();
  updateCartCount();
}
async function loadApprovedReviews(){
  try{
    const s=await getDocs(collection(db,"reviews"));
    const arr=s.docs
      .map(d=>d.data())
      .filter(r=>r.approved===true)
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    return arr.length?arr:defaults.reviews;
  }catch(e){ return defaults.reviews; }
}
function fillCategories(){
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
  document.getElementById("categoryFilter").innerHTML = `<option value="">전체 카테고리</option>` + cats.map(c=>`<option>${c}</option>`).join("");
}
window.renderProducts=()=>{
  const keyword=document.getElementById("productSearch").value.trim().toLowerCase();
  const cat=document.getElementById("categoryFilter").value;
  const list=products.filter(p=>(!cat||p.category===cat)&&(!keyword||`${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(keyword)));
  document.getElementById("productList").innerHTML=list.map(p=>{
    const imgs=(p.images&&p.images.length?p.images:(p.image?[p.image]:[]));
    const gallery=imgs.length?`<div class="gallery">${imgs.map(i=>`<img src="${i}">`).join("")}</div>`:"";
    return `<article class="productCard">${gallery}<span class="badge">${p.stock||"주문 가능"}</span><h3>${p.name||""}</h3><p>${p.desc||""}</p>${p.sale?`<div class="sale">${p.price||""}</div><strong class="price">${p.sale}</strong>`:`<strong class="price">${p.price||"문의"}</strong>`}<button class="btn primary" onclick='addToCart(${JSON.stringify(p).replaceAll("'","&#39;")})'>장바구니</button><button class="btn secondary" onclick='buyNow(${JSON.stringify(p).replaceAll("'","&#39;")})'>바로 구매</button></article>`;
  }).join("") || `<article><h3>상품이 없습니다.</h3><p>관리자 페이지에서 상품을 등록해 주세요.</p></article>`;
};
window.addToCart=(p)=>{
  const found=cart.find(i=>i.id===p.id);
  if(found) found.qty++;
  else cart.push({id:p.id,name:p.name,price:p.sale||p.price,qty:1});
  saveCart();
  alert("장바구니에 담았습니다.");
};
window.buyNow=(p)=>{ window.addToCart(p); openCart(); };

async function loadPaymentInfo(){
  try{
    const s=await getDocs(collection(db,"settings"));
    let item=null;
    s.docs.forEach(d=>{ if(d.id==="payment") item=d.data(); });
    return item || {name:"천율도령",account:"02002407816",link:"",qr:"",guide:"송금 후 주문 신청을 눌러주세요. 입금 확인 후 상담 또는 상품 발송이 진행됩니다."};
  }catch(e){
    return {name:"천율도령",account:"02002407816",link:"",qr:"",guide:"송금 후 주문 신청을 눌러주세요."};
  }
}
function renderPayment(){
  const box=document.getElementById("kakaoPayInfo");
  if(!box) return;
  const p=paymentInfo || {};
  box.innerHTML = `
    ${p.qr?`<img class="payQr" src="${p.qr}" alt="카카오페이 QR">`:""}
    <div class="copyLine"><b>받는 사람</b><br>${p.name||"천율도령"}</div>
    <div class="copyLine"><b>카카오페이/계좌번호</b><br>${p.account||"02002407816"}</div>
    ${p.link?`<a class="btn primary" target="_blank" href="${p.link}">카카오페이 송금하기</a>`:""}
    <button class="btn secondary" onclick="copyPayAccount()">계좌번호 복사</button>
    <p class="tiny">${p.guide||"송금 후 주문 신청을 눌러주세요."}</p>
  `;
}
window.copyPayAccount=async()=>{
  const text=(paymentInfo?.account)||"02002407816";
  await navigator.clipboard.writeText(text);
  alert("계좌번호가 복사되었습니다.");
};

window.openCart=()=>{ renderCart(); renderPayment(); document.getElementById("cartModal").style.display="flex"; };
window.closeCart=()=>document.getElementById("cartModal").style.display="none";
function renderCart(){
  document.getElementById("cartItems").innerHTML=cart.map((i,idx)=>`<div class="cartRow"><b>${i.name}</b><span>${i.price} × ${i.qty}</span><button onclick="removeCart(${idx})">삭제</button></div>`).join("") || `<p>장바구니가 비어 있습니다.</p>`;
  document.getElementById("cartTotal").textContent = finalTotal().toLocaleString()+"원";
  if(couponDiscount){
    document.getElementById("cartTotal").textContent += ` (쿠폰 ${couponDiscount.toLocaleString()}원 할인)`;
  }
}
window.removeCart=(idx)=>{ cart.splice(idx,1); saveCart(); renderCart(); };
function orderText(){
  return `[천명신당 주문 신청]\n${cart.map(i=>`- ${i.name} / ${i.price} / ${i.qty}개`).join("\n")}\n합계: ${document.getElementById("cartTotal").textContent}\n주문자: ${orderName.value}\n연락처: ${orderContact.value}\n주소: ${orderAddress.value}\n요청: ${orderMemo.value}`;
}
window.copyOrder=async()=>{ await navigator.clipboard.writeText(orderText()); alert("주문 내용이 복사되었습니다."); };

function makeOrderNo(){
  const d=new Date();
  const y=String(d.getFullYear()).slice(2), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `CY${y}${m}${day}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}
async function getCoupon(code){
  if(!code) return null;
  const snap=await getDocs(collection(db,"coupons"));
  const found=snap.docs.map(d=>({id:d.id,...d.data()})).find(c=>(c.code||"").toUpperCase()===code.toUpperCase());
  return found || null;
}
window.applyCoupon=async()=>{
  const code=document.getElementById("couponCode")?.value?.trim();
  if(!code) return alert("쿠폰 코드를 입력해 주세요.");
  const c=await getCoupon(code);
  if(!c) return alert("사용 가능한 쿠폰이 없습니다.");
  couponInfo=c;
  couponDiscount=Number(String(c.discount||"").replace(/[^\d]/g,""))||0;
  alert(`${c.code} 쿠폰이 적용되었습니다.`);
  renderCart();
};
function subtotal(){
  return cart.reduce((a,b)=>a+wonNum(b.price)*(Number(b.qty)||1),0);
}
function finalTotal(){
  return Math.max(0, subtotal() - couponDiscount);
}
async function decreaseStock(){
  for(const item of cart){
    const p=products.find(x=>x.id===item.id);
    if(!p || !p.stock) continue;
    const n=parseInt(String(p.stock).replace(/[^\d]/g,""),10);
    if(Number.isFinite(n)){
      const next=Math.max(0,n-(Number(item.qty)||1));
      try{ await updateDoc(doc(db,"products",p.id),{stock: next===0 ? "품절" : `${next}개`}); }catch(e){}
    }
  }
}

window.submitOrder=async()=>{
  if(!cart.length) return alert("장바구니가 비어 있습니다.");
  if(!orderName.value||!orderContact.value) return alert("주문자와 연락처를 입력해 주세요.");
  const orderNo=makeOrderNo();
  await decreaseStock();
  await addDoc(collection(db,"orders"),{orderNo,items:cart,subtotal:subtotal().toLocaleString()+"원",discount:couponDiscount,total:finalTotal().toLocaleString()+"원",coupon:couponInfo?.code||"",name:orderName.value,contact:orderContact.value,address:orderAddress.value,memo:orderMemo.value,status:"입금대기",payment:"카카오페이 송금",trackingCompany:"",trackingNo:"",createdAt:serverTimestamp()});
  cart=[]; saveCart(); alert(`주문 신청이 접수되었습니다.\n주문번호: ${orderNo}\n카카오톡으로 결제 안내를 받으세요.`); couponDiscount=0; couponInfo=null; closeCart();
};

async function getAvailableTimes(){
  try{
    const s=await getDocs(collection(db,"settings"));
    let times=null;
    s.docs.forEach(d=>{ if(d.id==="bookingTimes") times=d.data().times; });
    return Array.isArray(times)&&times.length?times:["오전","오후","저녁","상담 후 조율"];
  }catch(e){ return ["오전","오후","저녁","상담 후 조율"]; }
}
window.loadAvailableTimes=async()=>{
  const times=await getAvailableTimes();
  const el=document.getElementById("bookTime");
  if(el) el.innerHTML=times.map(t=>`<option>${t}</option>`).join("");
};
setTimeout(()=>{ 
  const d=document.getElementById("bookDate");
  if(d) d.min=new Date().toISOString().slice(0,10);
  window.loadAvailableTimes?.();
},500);
window.submitBooking=async()=>{
  if(!bookName.value||!bookContact.value||!bookBody.value) return alert("이름, 연락처, 상담 내용을 입력해 주세요.");
  await addDoc(collection(db,"bookings"),{name:bookName.value,contact:bookContact.value,type:bookType.value,date:bookDate.value,time:bookTime.value,body:bookBody.value,status:"대기",createdAt:serverTimestamp()});
  alert("예약 신청이 접수되었습니다."); bookName.value=bookContact.value=bookBody.value="";
};
async function uploadOne(file,folder){
  if(!file) return "";
  const r=ref(storage,`${folder}/${Date.now()}_${file.name}`);
  await uploadBytes(r,file);
  return await getDownloadURL(r);
}
async function uploadFiles(fileList,folder){
  const urls=[];
  for(const file of Array.from(fileList||[])){
    const r=ref(storage,`${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(r,file);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
window.openReviewModal=()=>document.getElementById("reviewModal").style.display="flex";
window.closeReviewModal=()=>document.getElementById("reviewModal").style.display="none";
window.submitReview=async()=>{
  if(!reviewName.value||!reviewBody.value) return alert("이름과 후기 내용을 입력해 주세요.");
  const images=await uploadFiles(reviewImage.files,"reviews");
  await addDoc(collection(db,"reviews"),{name:reviewName.value,category:reviewCategory.value,stars:reviewStars.value,body:reviewBody.value,image:images[0]||"",images,approved:false,createdAt:serverTimestamp()});
  alert("후기 등록 요청이 완료되었습니다."); closeReviewModal();
};
init();
