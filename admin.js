import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app), storage=getStorage(app);
const $=id=>document.getElementById(id); const val=id=>($(id)?.value||"").trim(); const setVal=(id,v="")=>{if($(id))$(id).value=v};
function bind(id,fn){$(id)?.addEventListener("click",async e=>{e.preventDefault();try{await fn()}catch(err){console.error(err);alert("오류: "+(err.message||err))}})}
async function list(col){const s=await getDocs(collection(db,col));return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))}
async function uploadFiles(files,folder){const urls=[];for(const f of Array.from(files||[])){const r=ref(storage,`${folder}/${Date.now()}_${f.name}`);await uploadBytes(r,f);urls.push(await getDownloadURL(r))}return urls}
function gallery(x){const a=x.images||(x.image?[x.image]:[]);return a.length?`<div class="multiThumbs">${a.map(i=>`<img src="${i}">`).join("")}</div>`:""}

bind("loginBtn",async()=>{try{await signInWithEmailAndPassword(auth,val("adminEmail"),val("adminPassword"))}catch(e){$("loginError").innerHTML=`<p class="hint">로그인 실패</p>`}});
bind("logoutBtn",()=>signOut(auth));
onAuthStateChanged(auth,u=>{$("loginBox").classList.toggle("hidden",!!u);$("adminPanel").classList.toggle("hidden",!u);if(u){loadSettings();loadAll()}});

async function loadSettings(){
  const s=await list("settings");
  const p=s.find(x=>x.id==="payment")||{}; ["payName","payAccount","payLink","bankName","bankOwner","bankAccount","payGuide"].forEach(id=>setVal(id,p[id.replace("pay","").charAt(0).toLowerCase()+id.replace("pay","").slice(1)]||p[id]||""));
  setVal("payName",p.name||"");setVal("payAccount",p.account||"");setVal("payLink",p.link||"");setVal("payGuide",p.guide||"");setVal("bankName",p.bankName||"");setVal("bankOwner",p.bankOwner||"");setVal("bankAccount",p.bankAccount||"");
  const t=s.find(x=>x.id==="bookingTimes"); setVal("timesInput",(t?.times||[]).join("\n"));
}
bind("savePaymentBtn",async()=>{
  const imgs=await uploadFiles($("payQr").files,"payment");
  const data={name:val("payName")||"천율도령",account:val("payAccount"),link:val("payLink"),bankName:val("bankName"),bankOwner:val("bankOwner"),bankAccount:val("bankAccount"),guide:val("payGuide"),updatedAt:serverTimestamp()};
  if(imgs[0])data.qr=imgs[0]; await setDoc(doc(db,"settings","payment"),data,{merge:true}); alert("결제 정보 저장 완료");
});
bind("saveTimesBtn",async()=>{await setDoc(doc(db,"settings","bookingTimes"),{times:val("timesInput").split("\n").map(x=>x.trim()).filter(Boolean),updatedAt:serverTimestamp()},{merge:true});alert("예약 시간 저장 완료")});
bind("couponAddBtn",async()=>{await addDoc(collection(db,"coupons"),{code:val("couponCodeAdmin").toUpperCase(),discount:val("couponDiscount"),desc:val("couponDesc"),createdAt:serverTimestamp()});["couponCodeAdmin","couponDiscount","couponDesc"].forEach(id=>setVal(id));loadAll()});
bind("priceResetBtn",()=>["priceId","priceTitle","priceAmount","priceBadge","priceDesc"].forEach(id=>setVal(id)));
bind("priceSaveBtn",async()=>{const data={title:val("priceTitle"),price:val("priceAmount"),badge:val("priceBadge"),desc:val("priceDesc"),createdAt:serverTimestamp()}; if(val("priceId")) await updateDoc(doc(db,"consultPrices",val("priceId")),data); else await addDoc(collection(db,"consultPrices"),data);["priceId","priceTitle","priceAmount","priceBadge","priceDesc"].forEach(id=>setVal(id));loadAll()});
bind("productAddBtn",async()=>{const images=await uploadFiles($("pImages").files,"products");await addDoc(collection(db,"products"),{name:val("pName"),category:val("pCategory"),price:val("pPrice"),sale:val("pSale"),stock:val("pStock")||"주문 가능",desc:val("pDesc"),best:$("pBest").checked,images,createdAt:serverTimestamp()});["pName","pCategory","pPrice","pSale","pStock","pDesc"].forEach(id=>setVal(id));$("pImages").value="";loadAll()});
bind("noticeAddBtn",async()=>{await addDoc(collection(db,"notices"),{tag:val("noticeTag")||"공지",title:val("noticeTitle"),body:val("noticeBody"),createdAt:serverTimestamp()});["noticeTag","noticeTitle","noticeBody"].forEach(id=>setVal(id));loadAll()});
bind("postAddBtn",async()=>{const images=await uploadFiles($("postImages").files,"posts");await addDoc(collection(db,"posts"),{title:val("postTitle"),body:val("postBody"),images,createdAt:serverTimestamp()});["postTitle","postBody"].forEach(id=>setVal(id));$("postImages").value="";loadAll()});
bind("fieldAddBtn",async()=>{await addDoc(collection(db,"fields"),{title:val("fieldTitle"),body:val("fieldBody"),createdAt:serverTimestamp()});["fieldTitle","fieldBody"].forEach(id=>setVal(id));loadAll()});

async function loadAll(){
  const [orders,bookings,products,reviews,coupons,prices,notices,posts,fields]=await Promise.all(["orders","bookings","products","reviews","coupons","consultPrices","notices","posts","fields"].map(list));
  $("statOrders").textContent=orders.length;$("statBookings").textContent=bookings.length;$("statProducts").textContent=products.length;$("statReviews").textContent=reviews.length;
  $("couponList").innerHTML=coupons.map(c=>item(`${c.code} · ${c.discount}원`,c.desc,`<button onclick="del('coupons','${c.id}')">삭제</button>`)).join("");
  $("priceAdminList").innerHTML=prices.map(p=>item(`${p.title} · ${p.price}`,p.desc,`<button onclick="editPrice('${p.id}','${safe(p.title)}','${safe(p.price)}','${safe(p.badge)}','${safe(p.desc)}')">수정</button><button onclick="del('consultPrices','${p.id}')">삭제</button>`)).join("");
  $("productAdminList").innerHTML=products.map(p=>item(`${p.name} · ${p.price}`,`${p.category||""}<br>${p.stock||""}<br>${p.desc||""}${gallery(p)}`,`<button onclick="del('products','${p.id}')">삭제</button>`)).join("");
  $("noticeAdminList").innerHTML=notices.map(n=>item(`[${n.tag}] ${n.title}`,n.body,`<button onclick="del('notices','${n.id}')">삭제</button>`)).join("");
  $("postAdminList").innerHTML=posts.map(p=>item(p.title,`${p.body}${gallery(p)}`,`<button onclick="del('posts','${p.id}')">삭제</button>`)).join("");
  $("fieldAdminList").innerHTML=fields.map(f=>item(f.title,f.body,`<button onclick="del('fields','${f.id}')">삭제</button>`)).join("");
  $("orderList").innerHTML=orders.map(o=>item(`${o.orderNo||o.id} · ${o.name||""} · ${o.total||""}`,`${(o.items||[]).map(i=>`${i.name} ${i.qty}개`).join("<br>")}<br>연락처:${o.contact||""}<br>상태:${o.status||"입금대기"}<br>배송:${o.trackingCompany||""} ${o.trackingNo||""}`,`<button onclick="setStatus('orders','${o.id}','입금완료')">입금완료</button><button onclick="setStatus('orders','${o.id}','진행중')">진행중</button><button onclick="setStatus('orders','${o.id}','완료')">완료</button><button onclick="tracking('${o.id}')">배송조회 입력</button><button onclick="copyMsg('${safe(o.orderNo||o.id)}','${safe(o.name)}','${safe(o.total)}')">문자문구 복사</button><button onclick="del('orders','${o.id}')">삭제</button>`)).join("");
  $("bookingList").innerHTML=bookings.map(b=>item(`${b.name||""} · ${b.type||""}`,`${b.contact||""}<br>${b.date||""} ${b.time||""}<br>${b.body||""}<br>상태:${b.status||"대기"}`,`<button onclick="setStatus('bookings','${b.id}','확정')">확정</button><button onclick="setStatus('bookings','${b.id}','완료')">완료</button><button onclick="del('bookings','${b.id}')">삭제</button>`)).join("");
  const pending=reviews.filter(r=>r.approved!==true), approved=reviews.filter(r=>r.approved===true);
  $("pendingReviewList").innerHTML=pending.map(r=>item(`${r.name||"익명"} · ${r.stars||"★★★★★"}`,`${r.body||""}${gallery(r)}`,`<button onclick="approve('${r.id}')">승인</button><button onclick="del('reviews','${r.id}')">삭제</button>`)).join("")||"<p>승인 대기 후기가 없습니다.</p>";
  $("approvedReviewList").innerHTML=approved.map(r=>item(`${r.name||"익명"} · ${r.stars||"★★★★★"}`,`${r.body||""}${gallery(r)}`,`<button onclick="unapprove('${r.id}')">승인취소</button><button onclick="del('reviews','${r.id}')">삭제</button>`)).join("")||"<p>공개 후기가 없습니다.</p>";
}
function item(t,b,actions){return `<article class="adminItem"><h3>${t||""}</h3><p>${b||""}</p><div class="actions">${actions||""}</div></article>`}
function safe(s){return String(s||"").replaceAll("'","\\'").replaceAll("\n"," ")}
window.editPrice=(id,t,p,b,d)=>{setVal("priceId",id);setVal("priceTitle",t);setVal("priceAmount",p);setVal("priceBadge",b);setVal("priceDesc",d);location.hash="#prices"}
window.setStatus=async(c,id,status)=>{await updateDoc(doc(db,c,id),{status});loadAll()}
window.del=async(c,id)=>{if(confirm("삭제할까요?")){await deleteDoc(doc(db,c,id));loadAll()}}
window.approve=async(id)=>{await updateDoc(doc(db,"reviews",id),{approved:true});loadAll()}
window.unapprove=async(id)=>{await updateDoc(doc(db,"reviews",id),{approved:false});loadAll()}
window.tracking=async(id)=>{const trackingCompany=prompt("택배사/배송방법"); if(trackingCompany===null)return; const trackingNo=prompt("송장번호/배송메모"); if(trackingNo===null)return; await updateDoc(doc(db,"orders",id),{trackingCompany,trackingNo,status:"배송중"});loadAll()}
window.copyMsg=async(no,name,total)=>{await navigator.clipboard.writeText(`[천율도령 공식 신점 상담]\n${name}님 주문번호 ${no} 접수되었습니다.\n금액: ${total}\n입금 확인 후 진행됩니다.`);alert("문자/카카오톡 문구 복사 완료")}
