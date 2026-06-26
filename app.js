import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig);
const db=getFirestore(app);
const storage=getStorage(app);
const $=id=>document.getElementById(id);

let products=[], payment={}, couponDiscount=0, coupon=null;
let cart=JSON.parse(localStorage.getItem("cyCart")||"[]");

const defaults={
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

async function list(col,fallback=[]){
  try{const s=await getDocs(collection(db,col));return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))||fallback}catch(e){return fallback}
}
function esc(s){return String(s||"")}
function num(v){return Number(String(v||"").replace(/[^\d]/g,""))||0}
function saveCart(){localStorage.setItem("cyCart",JSON.stringify(cart));$("cartCount").textContent=cart.reduce((a,b)=>a+b.qty,0)}
function subtotal(){return cart.reduce((a,b)=>a+num(b.price)*b.qty,0)}
function finalTotal(){return Math.max(0,subtotal()-couponDiscount)}
function imgGallery(arr=[]){return arr.length?`<div class="gallery">${arr.map(i=>`<img src="${i}" alt="">`).join("")}</div>`:""}

async function init(){
  $("menuBtn")?.addEventListener("click",()=>$("nav").classList.toggle("show"));
  bindButtons();
  const notices=await list("notices",defaults.notices);
  $("noticeList").innerHTML=notices.map(n=>`<article class="card"><span class="badge">${esc(n.tag||"공지")}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join("");

  const prices=await list("consultPrices",defaults.prices);
  $("priceList").innerHTML=prices.map(p=>`<article class="card"><span class="badge">${esc(p.badge||"상담")}</span><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p><strong class="price">${esc(p.price||"문의")}</strong><a class="btn primary full" href="#booking">예약하기</a></article>`).join("");
  $("bookType").innerHTML=prices.map(p=>`<option>${esc(p.title)} ${esc(p.price)}</option>`).join("");

  const times=await getTimes(); $("bookTime").innerHTML=times.map(t=>`<option>${esc(t)}</option>`).join("");
  $("bookDate").min=new Date().toISOString().slice(0,10);

  products=await list("products",defaults.products);
  renderCategories(); renderProducts();

  const reviews=(await list("reviews",defaults.reviews)).filter(r=>r.approved===true);
  $("reviewList").innerHTML=(reviews.length?reviews:defaults.reviews).map(r=>`<article class="card">${imgGallery(r.images||(r.image?[r.image]:[]))}<strong class="price">${esc(r.stars||"★★★★★")}</strong><p>“${esc(r.body)}”</p><span>${esc(r.name)} · ${esc(r.category)}</span></article>`).join("");

  const posts=await list("posts",defaults.posts);
  $("postList").innerHTML=posts.map(p=>`<article class="card">${imgGallery(p.images||[])}<h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></article>`).join("");

  payment=await getPayment();
  saveCart();
}
function bindButtons(){
  $("searchInput").addEventListener("input",renderProducts);
  $("categorySelect").addEventListener("change",renderProducts);
  $("cartOpenBtn").addEventListener("click",openCart);
  $("cartCloseBtn").addEventListener("click",()=>$("cartModal").classList.remove("show"));
  $("orderBtn").addEventListener("click",submitOrder);
  $("couponBtn").addEventListener("click",applyCoupon);
  $("bookingBtn").addEventListener("click",submitBooking);
  $("reviewOpenBtn").addEventListener("click",()=>$("reviewModal").classList.add("show"));
  $("reviewCloseBtn").addEventListener("click",()=>$("reviewModal").classList.remove("show"));
  $("reviewSubmitBtn").addEventListener("click",submitReview);
}
function renderCategories(){
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
  $("categorySelect").innerHTML=`<option value="">전체 카테고리</option>`+cats.map(c=>`<option>${c}</option>`).join("");
}
function renderProducts(){
  const q=$("searchInput").value.toLowerCase(), c=$("categorySelect").value;
  const rows=products.filter(p=>(!c||p.category===c)&&(!q||`${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q)));
  $("productList").innerHTML=rows.map(p=>`<article class="productCard">${imgGallery(p.images||[])}<span class="badge">${esc(p.stock||"주문 가능")}</span><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>${p.sale?`<p class="hint"><s>${esc(p.price)}</s></p><strong class="price">${esc(p.sale)}</strong>`:`<strong class="price">${esc(p.price||"문의")}</strong>`}<button class="btn primary full addCart" data-id="${p.id}">장바구니</button></article>`).join("")||`<article class="card">상품이 없습니다.</article>`;
  document.querySelectorAll(".addCart").forEach(b=>b.addEventListener("click",()=>addCart(b.dataset.id)));
}
function addCart(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const f=cart.find(x=>x.id===id); if(f)f.qty++; else cart.push({id:p.id,name:p.name,price:p.sale||p.price,qty:1});
  saveCart(); alert("장바구니에 담았습니다.");
}
function openCart(){renderCart();renderPayment();$("cartModal").classList.add("show")}
function renderCart(){
  $("cartItems").innerHTML=cart.map((i,idx)=>`<div class="card"><b>${esc(i.name)}</b><p>${esc(i.price)} × ${i.qty}</p><button class="btn ghost full removeCart" data-i="${idx}">삭제</button></div>`).join("")||"<p>장바구니가 비어 있습니다.</p>";
  document.querySelectorAll(".removeCart").forEach(b=>b.addEventListener("click",()=>{cart.splice(Number(b.dataset.i),1);saveCart();renderCart()}));
  $("cartTotal").textContent=finalTotal().toLocaleString()+"원"+(couponDiscount?` (쿠폰 ${couponDiscount.toLocaleString()}원 할인)`:"");
}
async function getPayment(){
  const s=await list("settings",[]);
  return s.find(x=>x.id==="payment")||{name:"천율도령",account:"02002407816",bankName:"",bankOwner:"",bankAccount:"",guide:"송금 후 주문 신청을 눌러주세요."}
}
function renderPayment(){
  $("paymentInfo").innerHTML=`${payment.qr?`<img class="payQr" src="${payment.qr}" alt="QR">`:""}<div class="copyLine"><b>카카오페이</b><br>${esc(payment.name)}<br>${esc(payment.account||"")}</div>${payment.bankAccount?`<div class="copyLine"><b>계좌이체</b><br>${esc(payment.bankName)} ${esc(payment.bankAccount)}<br>예금주: ${esc(payment.bankOwner)}</div>`:""}${payment.link?`<a class="btn primary full" target="_blank" href="${payment.link}">카카오페이 송금하기</a>`:""}<button class="btn ghost full" id="copyPayBtn" type="button">계좌/번호 복사</button><p class="hint">${esc(payment.guide)}</p>`;
  $("copyPayBtn").addEventListener("click",async()=>{await navigator.clipboard.writeText(payment.bankAccount||payment.account||"");alert("복사되었습니다.")});
}
async function applyCoupon(){
  const code=$("couponInput").value.trim().toUpperCase(); if(!code)return alert("쿠폰 코드를 입력해 주세요.");
  const coupons=await list("coupons",[]); const c=coupons.find(x=>(x.code||"").toUpperCase()===code);
  if(!c)return alert("사용 가능한 쿠폰이 없습니다.");
  coupon=c; couponDiscount=num(c.discount); alert("쿠폰이 적용되었습니다."); renderCart();
}
function orderNo(){const d=new Date();return "CY"+d.toISOString().slice(2,10).replaceAll("-","")+"-"+Math.random().toString(36).slice(2,7).toUpperCase()}
async function submitOrder(){
  if(!cart.length)return alert("장바구니가 비어 있습니다.");
  if(!$("orderName").value||!$("orderContact").value)return alert("주문자와 연락처를 입력해 주세요.");
  const no=orderNo();
  await addDoc(collection(db,"orders"),{orderNo:no,items:cart,total:finalTotal().toLocaleString()+"원",discount:couponDiscount,coupon:coupon?.code||"",name:$("orderName").value,contact:$("orderContact").value,address:$("orderAddress").value,memo:$("orderMemo").value,status:"입금대기",payment:"카카오페이/계좌이체",trackingCompany:"",trackingNo:"",createdAt:serverTimestamp()});
  await decreaseStock();
  cart=[]; coupon=null; couponDiscount=0; saveCart(); $("cartModal").classList.remove("show");
  alert(`주문 신청 완료\n주문번호: ${no}`);
}
async function decreaseStock(){
  for(const item of cart){
    const p=products.find(x=>x.id===item.id); const n=parseInt(String(p?.stock||"").replace(/[^\d]/g,""),10);
    if(Number.isFinite(n))try{
      const next = Math.max(0,n-item.qty);
      await updateDoc(doc(db,"products",p.id),{stock: next<=0 ? "품절" : `${next}개`});
    }catch(e){}
  }
}
async function getTimes(){const s=await list("settings",[]);return s.find(x=>x.id==="bookingTimes")?.times||["오전","오후","저녁","상담 후 조율"]}
async function submitBooking(){
  if(!$("bookName").value||!$("bookContact").value)return alert("이름과 연락처를 입력해 주세요.");
  await addDoc(collection(db,"bookings"),{name:$("bookName").value,contact:$("bookContact").value,type:$("bookType").value,date:$("bookDate").value,time:$("bookTime").value,body:$("bookBody").value,status:"대기",createdAt:serverTimestamp()});
  alert("예약 신청이 접수되었습니다.");
}
async function optimizeImage(file,max=1600,quality=.82){
  if(!file || !file.type.startsWith("image/")) return file;
  const img = await new Promise((resolve,reject)=>{
    const i = new Image();
    i.onload=()=>resolve(i);
    i.onerror=reject;
    i.src=URL.createObjectURL(file);
  });
  const scale = Math.min(1, max / Math.max(img.width,img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const blob = await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
  return new File([blob], file.name.replace(/\.[^.]+$/,"") + ".jpg", {type:"image/jpeg"});
}
async function uploadFiles(fileList,folder){
  const urls=[];
  for(const f of Array.from(fileList||[])){
    const file = await optimizeImage(f);
    const r=ref(storage,`${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(r,file);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
async function submitReview(){
  if(!$("reviewName").value||!$("reviewBody").value)return alert("이름과 후기 내용을 입력해 주세요.");
  const images=await uploadFiles($("reviewImages").files,"reviews");
  await addDoc(collection(db,"reviews"),{name:$("reviewName").value,category:$("reviewCategory").value,stars:$("reviewStars").value,body:$("reviewBody").value,images,image:images[0]||"",approved:false,createdAt:serverTimestamp()});
  $("reviewModal").classList.remove("show"); alert("후기 등록 요청 완료");
}
init();
