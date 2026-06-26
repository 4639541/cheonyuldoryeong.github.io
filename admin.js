import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const storage=getStorage(app);
const $=id=>document.getElementById(id);
const val=id=>($(id)?.value||"").trim();
const setVal=(id,v="")=>{if($(id))$(id).value=v;};
function safe(s){return String(s||"").replaceAll("'","\\'").replaceAll("\n"," ");}
function moneyNumber(v){return Number(String(v||"").replace(/[^\d]/g,""))||0;}
function bind(id,fn){$(id)?.addEventListener("click",async e=>{e.preventDefault();try{await fn();}catch(err){console.error(err);alert("오류: "+(err.message||err));}});}
async function list(col){
  const s=await getDocs(collection(db,col));
  return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
}
async function optimizeImage(file,max=1600,quality=.82){
  if(!file || !file.type.startsWith("image/")) return file;
  const img=await new Promise((resolve,reject)=>{
    const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=URL.createObjectURL(file);
  });
  const scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(img.width*scale);
  canvas.height=Math.round(img.height*scale);
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
  return new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
}
async function uploadFiles(files,folder){
  const urls=[];
  for(const f of Array.from(files||[])){
    const file=await optimizeImage(f);
    const r=ref(storage,`${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(r,file);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
function gallery(x){
  const arr=x.images||(x.image?[x.image]:[]);
  return arr.length?`<div class="multi">${arr.map(i=>`<img src="${i}">`).join("")}</div>`:"";
}
function item(title,body,actions){
  return `<article class="item"><h3>${title||""}</h3><p>${body||""}</p><div class="actions">${actions||""}</div></article>`;
}

bind("loginBtn",async()=>{try{await signInWithEmailAndPassword(auth,val("adminEmail"),val("adminPassword"));}catch(e){$("loginError").innerHTML=`<p class="hint">로그인 실패: 이메일 또는 비밀번호를 확인해 주세요.</p>`;}});
bind("logoutBtn",()=>signOut(auth));
onAuthStateChanged(auth,u=>{
  $("loginBox").classList.toggle("hidden",!!u);
  $("adminPanel").classList.toggle("hidden",!u);
  if(u){loadSettings();loadAll();}
});

async function loadSettings(){
  const settings=await list("settings");

  
  const biz=settings.find(x=>x.id==="business")||{};
  setVal("bizNameAdmin",biz.name||"천율도령");
  setVal("bizOwnerAdmin",biz.owner||"정세진");
  setVal("bizNumberAdmin",biz.number||"570-76-00713");
  setVal("bizAddressAdmin",biz.address||"경상북도 구미시 상모로12길 49, 101동 102호");
  setVal("bizTypeAdmin",biz.type||"협회 및 단체, 수리 및 기타 개인서비스업");
  setVal("bizItemAdmin",biz.item||"점술 및 유사 서비스업");
  setVal("bizContactAdmin",biz.contact||"카카오톡 오픈프로필 '천율도령'");
  setVal("bizMailOrderAdmin",biz.mailOrder||"신고 예정");
  setVal("bizEmailAdmin",biz.email||"");
  setVal("bizKakaoAdmin",biz.kakao||"");

  const p=settings.find(x=>x.id==="payment")||{};
  setVal("payName",p.name||"");
  setVal("payAccount",p.account||"");
  setVal("payLink",p.link||"");
  setVal("bankName",p.bankName||"");
  setVal("bankOwner",p.bankOwner||"");
  setVal("bankAccount",p.bankAccount||"");
  setVal("payGuide",p.guide||"");
  const t=settings.find(x=>x.id==="bookingTimes")||{};
  setVal("timesInput",(t.times||[]).join("\n"));
  setVal("blockedDatesInput",(t.blockedDates||[]).join("\n"));
}

async function saveBusiness(){
  await setDoc(doc(db,"settings","business"),{
    footerName:"천율도령 공식 신점 상담",
    name:val("bizNameAdmin") || "천율도령",
    owner:val("bizOwnerAdmin") || "정세진",
    number:val("bizNumberAdmin") || "570-76-00713",
    address:val("bizAddressAdmin") || "경상북도 구미시 상모로12길 49, 101동 102호",
    type:val("bizTypeAdmin") || "협회 및 단체, 수리 및 기타 개인서비스업",
    item:val("bizItemAdmin") || "점술 및 유사 서비스업",
    contact:val("bizContactAdmin") || "카카오톡 오픈프로필 '천율도령'",
    mailOrder:val("bizMailOrderAdmin") || "신고 예정",
    email:val("bizEmailAdmin"),
    kakao:val("bizKakaoAdmin"),
    updatedAt:serverTimestamp()
  },{merge:true});
  alert("사업자 정보가 저장되었습니다.");
}

bind("saveBusinessBtn",saveBusiness);


bind("saveBusinessBtn", window.saveBusiness);


bind("saveBusinessBtn", window.saveBusiness);
bind("savePaymentBtn",async()=>{
  const imgs=await uploadFiles($("payQr").files,"payment");
  const data={name:val("payName")||"천율도령",account:val("payAccount"),link:val("payLink"),bankName:val("bankName"),bankOwner:val("bankOwner"),bankAccount:val("bankAccount"),guide:val("payGuide"),updatedAt:serverTimestamp()};
  if(imgs[0]) data.qr=imgs[0];
  await setDoc(doc(db,"settings","payment"),data,{merge:true});
  alert("결제 정보가 저장되었습니다.");
});
bind("saveTimesBtn",async()=>{
  await setDoc(doc(db,"settings","bookingTimes"),{
    times:val("timesInput").split("\n").map(x=>x.trim()).filter(Boolean),
    blockedDates:val("blockedDatesInput").split("\n").map(x=>x.trim()).filter(Boolean),
    updatedAt:serverTimestamp()
  },{merge:true});
  alert("예약 가능 시간이 저장되었습니다.");
});

function makeCouponCode(prefix="CHEON"){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = (prefix || "CHEON").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
  code += "-";
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
bind("couponAutoBtn",async()=>{
  const discount = val("couponDiscount");
  if(!discount) return alert("할인금액을 먼저 입력해 주세요.");
  const prefix = val("couponPrefix") || "CHEON";
  const count = Math.min(100, Math.max(1, parseInt(val("couponCount") || "1", 10)));
  const desc = val("couponDesc") || "자동 발급 쿠폰";
  const made = [];
  for(let i=0;i<count;i++){
    const code = makeCouponCode(prefix);
    made.push(code);
    await addDoc(collection(db,"coupons"),{
      code,
      discount,
      desc,
      auto:true,
      used:false,
      createdAt:serverTimestamp()
    });
  }
  setVal("couponCodeAdmin", made[0] || "");
  alert(`쿠폰 ${made.length}개가 자동 발급되었습니다.\n첫 쿠폰: ${made[0]}`);
  loadAll();
});

bind("couponAddBtn",async()=>{
  if(!val("couponCodeAdmin")||!val("couponDiscount")) return alert("쿠폰 코드와 할인금액을 입력해 주세요.");
  await addDoc(collection(db,"coupons"),{code:val("couponCodeAdmin").toUpperCase(),discount:val("couponDiscount"),desc:val("couponDesc"),auto:false,used:false,createdAt:serverTimestamp()});
  ["couponCodeAdmin","couponDiscount","couponDesc"].forEach(id=>setVal(id));
  loadAll();
});
bind("priceResetBtn",()=>["priceId","priceTitle","priceAmount","priceBadge","priceDesc"].forEach(id=>setVal(id)));
bind("priceSaveBtn",async()=>{
  if(!val("priceTitle")||!val("priceAmount")) return alert("상담명과 가격을 입력해 주세요.");
  const data={title:val("priceTitle"),price:val("priceAmount"),badge:val("priceBadge"),desc:val("priceDesc"),createdAt:serverTimestamp()};
  if(val("priceId")) await updateDoc(doc(db,"consultPrices",val("priceId")),data);
  else await addDoc(collection(db,"consultPrices"),data);
  ["priceId","priceTitle","priceAmount","priceBadge","priceDesc"].forEach(id=>setVal(id));
  loadAll();
});
bind("productAddBtn",async()=>{
  if(!val("pName")||!val("pPrice")) return alert("상품명과 가격을 입력해 주세요.");
  const images=await uploadFiles($("pImages").files,"products");
  await addDoc(collection(db,"products"),{name:val("pName"),category:val("pCategory"),price:val("pPrice"),sale:val("pSale"),stock:val("pStock")||"주문 가능",desc:val("pDesc"),best:$("pBest").checked,images,createdAt:serverTimestamp()});
  ["pName","pCategory","pPrice","pSale","pStock","pDesc"].forEach(id=>setVal(id));
  $("pImages").value="";
  loadAll();
});
bind("noticeAddBtn",async()=>{
  await addDoc(collection(db,"notices"),{tag:val("noticeTag")||"공지",title:val("noticeTitle"),body:val("noticeBody"),createdAt:serverTimestamp()});
  ["noticeTag","noticeTitle","noticeBody"].forEach(id=>setVal(id));
  loadAll();
});
bind("postAddBtn",async()=>{
  const images=await uploadFiles($("postImages").files,"posts");
  await addDoc(collection(db,"posts"),{title:val("postTitle"),body:val("postBody"),images,createdAt:serverTimestamp()});
  ["postTitle","postBody"].forEach(id=>setVal(id));
  $("postImages").value="";
  loadAll();
});

async function loadAll(){
  const [orders,bookings,products,reviews,coupons,prices,notices,posts]=await Promise.all(["orders","bookings","products","reviews","coupons","consultPrices","notices","posts"].map(list));
  $("statOrders").textContent=orders.length;
  $("statBookings").textContent=bookings.length;
  $("statProducts").textContent=products.length;
  $("statReviews").textContent=reviews.length;
  if($("statSales")) $("statSales").textContent=orders.reduce((sum,o)=>sum+moneyNumber(o.total),0).toLocaleString()+"원";

  $("couponList").innerHTML=coupons.map(c=>item(`${c.code} · ${c.discount}원 할인`,`${c.desc||""}<br>${c.auto?"자동 발급":"수동 등록"} / ${c.used?"사용됨":"미사용"}`,`<button class="danger" onclick="del('coupons','${c.id}')">삭제</button>`)).join("")||"<p>쿠폰이 없습니다.</p>";
  $("priceAdminList").innerHTML=prices.map(p=>item(`${p.title} · ${p.price}`,p.desc,`<button onclick="editPrice('${p.id}','${safe(p.title)}','${safe(p.price)}','${safe(p.badge)}','${safe(p.desc)}')">수정</button><button class="danger" onclick="del('consultPrices','${p.id}')">삭제</button>`)).join("")||"<p>상담 가격이 없습니다.</p>";
  $("productAdminList").innerHTML=products.map(p=>item(`${p.name} · ${p.price}`,`${p.category||""}<br>${p.stock||""}<br>${p.desc||""}${gallery(p)}`,`<button class="danger" onclick="del('products','${p.id}')">삭제</button>`)).join("")||"<p>상품이 없습니다.</p>";
  $("noticeAdminList").innerHTML=notices.map(n=>item(`[${n.tag}] ${n.title}`,n.body,`<button class="danger" onclick="del('notices','${n.id}')">삭제</button>`)).join("")||"<p>공지사항이 없습니다.</p>";
  $("postAdminList").innerHTML=posts.map(p=>item(p.title,`${p.body}${gallery(p)}`,`<button class="danger" onclick="del('posts','${p.id}')">삭제</button>`)).join("")||"<p>게시글이 없습니다.</p>";

  $("orderList").innerHTML=orders.map(o=>item(`${o.orderNo||o.id} · ${o.name||""} · ${o.total||""}`,`${(o.items||[]).map(i=>`${i.name} ${i.qty}개`).join("<br>")}<br>연락처: ${o.contact||""}<br>주소: ${o.address||""}<br>상태: ${o.status||"입금대기"}<br>쿠폰: ${o.coupon||"-"} / 할인: ${o.discount||0}원<br>배송: ${o.trackingCompany||"-"} ${o.trackingNo||""}`,`<button onclick="setStatus('orders','${o.id}','입금완료')">입금완료</button><button onclick="setStatus('orders','${o.id}','진행중')">진행중</button><button onclick="setStatus('orders','${o.id}','완료')">완료</button><button onclick="tracking('${o.id}')">배송조회 입력</button><button onclick="copyMsg('${safe(o.orderNo||o.id)}','${safe(o.name)}','${safe(o.total)}')">문자문구 복사</button><button class="danger" onclick="del('orders','${o.id}')">삭제</button>`)).join("")||"<p>주문이 없습니다.</p>";
  $("bookingList").innerHTML=bookings.map(b=>item(`${b.name||""} · ${b.type||""}`,`${b.contact||""}<br>${b.date||""} ${b.time||""}<br>${b.body||""}<br>상태: ${b.status||"대기"}`,`<button onclick="setStatus('bookings','${b.id}','확정')">확정</button><button onclick="setStatus('bookings','${b.id}','완료')">완료</button><button class="danger" onclick="del('bookings','${b.id}')">삭제</button>`)).join("")||"<p>예약이 없습니다.</p>";

  const pending=reviews.filter(r=>r.approved!==true);
  const approved=reviews.filter(r=>r.approved===true);
  $("pendingReviewList").innerHTML=pending.map(r=>item(`${r.name||"익명"} · ${r.stars||"★★★★★"}`,`${r.body||""}${gallery(r)}`,`<button onclick="approve('${r.id}')">승인</button><button class="danger" onclick="del('reviews','${r.id}')">삭제</button>`)).join("")||"<p>승인 대기 후기가 없습니다.</p>";
  $("approvedReviewList").innerHTML=approved.map(r=>item(`${r.name||"익명"} · ${r.stars||"★★★★★"}`,`${r.body||""}${gallery(r)}`,`<button onclick="unapprove('${r.id}')">승인취소</button><button class="danger" onclick="del('reviews','${r.id}')">삭제</button>`)).join("")||"<p>공개 후기가 없습니다.</p>";
}
window.editPrice=(id,t,p,b,d)=>{setVal("priceId",id);setVal("priceTitle",t);setVal("priceAmount",p);setVal("priceBadge",b);setVal("priceDesc",d);location.hash="#prices";};
window.setStatus=async(c,id,status)=>{await updateDoc(doc(db,c,id),{status});loadAll();};
window.del=async(c,id)=>{if(confirm("삭제할까요?")){await deleteDoc(doc(db,c,id));loadAll();}};
window.approve=async(id)=>{await updateDoc(doc(db,"reviews",id),{approved:true});loadAll();};
window.unapprove=async(id)=>{await updateDoc(doc(db,"reviews",id),{approved:false});loadAll();};
window.tracking=async(id)=>{
  const trackingCompany=prompt("택배사/배송방법을 입력하세요.");
  if(trackingCompany===null) return;
  const trackingNo=prompt("송장번호/배송메모를 입력하세요.");
  if(trackingNo===null) return;
  await updateDoc(doc(db,"orders",id),{trackingCompany,trackingNo,status:"배송중"});
  loadAll();
};
window.copyMsg=async(no,name,total)=>{
  await navigator.clipboard.writeText(`[천율도령 공식 신점 상담]\n${name}님 주문번호 ${no} 접수되었습니다.\n금액: ${total}\n입금 확인 후 진행됩니다.`);
  alert("문자/카카오톡 문구가 복사되었습니다.");
};


window.saveBusiness = async ()=>{
  try{
    await setDoc(doc(db,"settings","business"),{
      footerName:"천율도령 공식 신점 상담",
      name:val("bizNameAdmin") || "천율도령",
      owner:val("bizOwnerAdmin") || "정세진",
      number:val("bizNumberAdmin") || "570-76-00713",
      address:val("bizAddressAdmin") || "경상북도 구미시 상모로12길 49, 101동 102호",
      type:val("bizTypeAdmin") || "협회 및 단체, 수리 및 기타 개인서비스업",
      item:val("bizItemAdmin") || "점술 및 유사 서비스업",
      contact:val("bizContactAdmin") || "카카오톡 오픈프로필 '천율도령'",
      mailOrder:val("bizMailOrderAdmin") || "신고 예정",
      email:val("bizEmailAdmin"),
      kakao:val("bizKakaoAdmin"),
      updatedAt:serverTimestamp()
    },{merge:true});
    alert("사업자 정보가 저장되었습니다.");
    await loadBusinessFinal();
  }catch(e){
    alert("사업자 정보 저장 실패: " + e.message);
  }
};

async function loadBusinessFinal(){
  try{
    const settings = await list("settings");
    const biz = settings.find(x=>x.id==="business") || {};
    setVal("bizNameAdmin", biz.name || "천율도령");
    setVal("bizOwnerAdmin", biz.owner || "정세진");
    setVal("bizNumberAdmin", biz.number || "570-76-00713");
    setVal("bizAddressAdmin", biz.address || "경상북도 구미시 상모로12길 49, 101동 102호");
    setVal("bizTypeAdmin", biz.type || "협회 및 단체, 수리 및 기타 개인서비스업");
    setVal("bizItemAdmin", biz.item || "점술 및 유사 서비스업");
    setVal("bizContactAdmin", biz.contact || "카카오톡 오픈프로필 '천율도령'");
    setVal("bizMailOrderAdmin", biz.mailOrder || "신고 예정");
    setVal("bizEmailAdmin", biz.email || "");
    setVal("bizKakaoAdmin", biz.kakao || "");
  }catch(e){
    console.warn("사업자 정보 로딩 실패", e);
  }
}

setTimeout(()=>{
  document.getElementById("saveBusinessBtn")?.addEventListener("click", window.saveBusiness);
  loadBusinessFinal();
}, 500);


window.savePaymentFinal = async ()=>{
  try{
    let qr = "";
    const fileInput = document.getElementById("payQr");
    if(fileInput && fileInput.files && fileInput.files[0]){
      const urls = await uploadFiles(fileInput.files, "payment");
      qr = urls[0] || "";
    }
    const data = {
      name: val("payName") || "천율도령",
      account: val("payAccount") || "02002407816",
      link: val("payLink"),
      bankName: val("bankName"),
      bankOwner: val("bankOwner"),
      bankAccount: val("bankAccount"),
      guide: val("payGuide") || "송금 후 주문 신청을 눌러주세요.",
      updatedAt: serverTimestamp()
    };
    if(qr) data.qr = qr;
    await setDoc(doc(db,"settings","payment"), data, {merge:true});
    alert("결제 정보가 저장되었습니다.");
    await loadPaymentFinal();
  }catch(e){
    alert("결제 정보 저장 실패: " + e.message);
  }
};

async function loadPaymentFinal(){
  try{
    const settings = await list("settings");
    const p = settings.find(x=>x.id==="payment") || {};
    setVal("payName", p.name || "천율도령");
    setVal("payAccount", p.account || "02002407816");
    setVal("payLink", p.link || "");
    setVal("bankName", p.bankName || "");
    setVal("bankOwner", p.bankOwner || "");
    setVal("bankAccount", p.bankAccount || "");
    setVal("payGuide", p.guide || "송금 후 주문 신청을 눌러주세요.");
  }catch(e){
    console.warn("결제 정보 로딩 실패", e);
  }
}

setTimeout(()=>{
  const btn = document.getElementById("savePaymentBtn");
  if(btn){
    btn.onclick = (e)=>{e.preventDefault(); window.savePaymentFinal();};
  }
  loadPaymentFinal();
}, 700);

function makeCouponCodeFinal(prefix="CHEON"){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = (prefix || "CHEON").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8) || "CHEON";
  code += "-";
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

setTimeout(()=>{
  const autoBtn = document.getElementById("couponAutoBtn");
  const addBtn = document.getElementById("couponAddBtn");

  if(autoBtn){
    autoBtn.onclick = async (e)=>{
      e.preventDefault();
      const discount = val("couponDiscount");
      if(!discount) return alert("할인금액을 입력해 주세요.");
      const prefix = val("couponPrefix") || "CHEON";
      const count = Math.min(100, Math.max(1, parseInt(val("couponCount") || "1", 10)));
      const desc = val("couponDesc") || "자동 발급 쿠폰";
      const made = [];
      for(let i=0;i<count;i++){
        const code = makeCouponCodeFinal(prefix);
        made.push(code);
        await addDoc(collection(db,"coupons"),{
          code, discount, desc, auto:true, used:false, createdAt:serverTimestamp()
        });
      }
      setVal("couponCodeAdmin", made[0] || "");
      alert(`쿠폰 ${made.length}개가 자동 발급되었습니다.`);
      loadAll();
    };
  }

  if(addBtn){
    addBtn.onclick = async (e)=>{
      e.preventDefault();
      if(!val("couponCodeAdmin") || !val("couponDiscount")) return alert("쿠폰 코드와 할인금액을 입력해 주세요.");
      await addDoc(collection(db,"coupons"),{
        code:val("couponCodeAdmin").toUpperCase(),
        discount:val("couponDiscount"),
        desc:val("couponDesc") || "수동 등록 쿠폰",
        auto:false,
        used:false,
        createdAt:serverTimestamp()
      });
      ["couponCodeAdmin","couponDiscount","couponDesc"].forEach(id=>setVal(id));
      alert("쿠폰이 등록되었습니다.");
      loadAll();
    };
  }
}, 800);

async function refreshCouponStatsFinal(){
  try{
    const coupons = await list("coupons");
    const total = coupons.length;
    const used = coupons.filter(c=>c.used===true).length;
    const usable = total - used;
    if(document.getElementById("couponTotal")) document.getElementById("couponTotal").textContent = total;
    if(document.getElementById("couponUsable")) document.getElementById("couponUsable").textContent = usable;
    if(document.getElementById("couponUsed")) document.getElementById("couponUsed").textContent = used;
  }catch(e){}
}
setInterval(refreshCouponStatsFinal, 2000);
setTimeout(refreshCouponStatsFinal, 1000);
