import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (id) => document.getElementById(id);
function val(id){ return ($(id)?.value || "").trim(); }
function setVal(id,v=""){ if($(id)) $(id).value=v; }
function showErr(id,msg){ if($(id)) $(id).innerHTML = msg ? `<div class="errorBox">${msg}</div>` : ""; }
function status(id,msg){ if($(id)) $(id).textContent = msg || ""; }

function bind(id, fn){
  const el = $(id);
  if(el) el.addEventListener("click", async (e)=>{
    e.preventDefault();
    try{ await fn(); }catch(err){ console.error(err); alert("오류: " + (err.message || err)); }
  });
}

async function adminLogin(){
  showErr("loginError","");
  try{
    await signInWithEmailAndPassword(auth, val("adminEmail"), val("adminPassword"));
  }catch(e){
    showErr("loginError","로그인 실패: 이메일 또는 비밀번호를 확인해 주세요.");
  }
}
async function adminLogout(){ await signOut(auth); }

onAuthStateChanged(auth, (user)=>{
  $("loginBox")?.classList.toggle("hidden", !!user);
  $("adminPanel")?.classList.toggle("hidden", !user);
  if(user){ loadPaymentSetting(); loadAll(); }
});

async function uploadFiles(fileList, folder){
  const files = Array.from(fileList || []);
  const urls = [];
  for(const file of files){
    if(!file.type.startsWith("image/")) continue;
    const safeName = file.name.replace(/[^\w가-힣.-]/g, "_");
    const fileRef = ref(storage, `${folder}/${Date.now()}_${safeName}`);
    await uploadBytes(fileRef, file);
    urls.push(await getDownloadURL(fileRef));
  }
  return urls;
}



async function savePayment(){
  status("paymentStatus","저장 중입니다...");
  let qr = "";
  const file = $("payQr")?.files?.[0];
  if(file){
    const urls = await uploadFiles([file], "payment");
    qr = urls[0] || "";
  }
  const data = {
    name: val("payName") || "천율도령",
    account: val("payAccount") || "02002407816",
    link: val("payLink"),
    guide: val("payGuide") || "송금 후 주문 신청을 눌러주세요. 입금 확인 후 상담 또는 상품 발송이 진행됩니다.",
    updatedAt: serverTimestamp()
  };
  if(qr) data.qr = qr;
  await setDoc(doc(db,"settings","payment"), data, {merge:true});
  status("paymentStatus","카카오페이 송금 정보 저장 완료");
  alert("결제 정보가 저장되었습니다.");
}
async function loadPaymentSetting(){
  try{
    const s = await getDocs(collection(db,"settings"));
    s.docs.forEach(d=>{
      if(d.id==="payment"){
        const p=d.data();
        setVal("payName", p.name||"");
        setVal("payAccount", p.account||"");
        setVal("payLink", p.link||"");
        setVal("payGuide", p.guide||"");
      }
    });
  }catch(e){ console.error(e); }
}

function resetConsultForm(){
  setVal("consultId"); setVal("consultTitle"); setVal("consultPrice"); setVal("consultBadge"); setVal("consultDesc");
}
async function saveConsult(){
  if(!val("consultTitle") || !val("consultPrice")) return alert("상담명과 가격을 입력해 주세요.");
  const id = val("consultId");
  const data = {
    title: val("consultTitle"),
    price: val("consultPrice"),
    badge: val("consultBadge") || "상담",
    desc: val("consultDesc"),
    createdAt: serverTimestamp()
  };
  if(id){
    await updateDoc(doc(db,"consultPrices",id), data);
    alert("상담 가격이 수정되었습니다.");
  }else{
    await addDoc(collection(db,"consultPrices"), data);
    alert("상담 가격이 등록되었습니다.");
  }
  resetConsultForm();
  await loadAll();
}
window.editConsult = (id,title,price,badge,desc)=>{
  setVal("consultId", id);
  setVal("consultTitle", title);
  setVal("consultPrice", price);
  setVal("consultBadge", badge);
  setVal("consultDesc", desc);
  window.scrollTo({top:0,behavior:"smooth"});
};

async function addProduct(){
  if(!val("pName") || !val("pPrice")) return alert("상품명과 판매가를 입력해 주세요.");
  status("productStatus","이미지 업로드 중입니다...");
  const images = await uploadFiles($("pImages")?.files, "products");
  status("productStatus","상품 등록 중입니다...");
  await addDoc(collection(db,"products"),{
    name: val("pName"),
    category: val("pCategory"),
    price: val("pPrice"),
    sale: val("pSale"),
    stock: val("pStock") || "주문 가능",
    desc: val("pDesc"),
    best: $("pBest")?.checked || false,
    images,
    createdAt: serverTimestamp()
  });
  ["pName","pCategory","pPrice","pSale","pStock","pDesc"].forEach(id=>setVal(id));
  if($("pImages")) $("pImages").value = "";
  if($("pBest")) $("pBest").checked = false;
  status("productStatus","상품 등록 완료");
  alert("상품이 등록되었습니다.");
  await loadAll();
}
async function addPost(){
  if(!val("postTitle") || !val("postBody")) return alert("제목과 내용을 입력해 주세요.");
  status("postStatus","이미지 업로드 중입니다...");
  const images = await uploadFiles($("postImages")?.files, "posts");
  await addDoc(collection(db,"posts"),{title:val("postTitle"),body:val("postBody"),images,createdAt:serverTimestamp()});
  setVal("postTitle"); setVal("postBody"); if($("postImages")) $("postImages").value="";
  status("postStatus","게시글 등록 완료");
  alert("게시글이 등록되었습니다.");
  await loadAll();
}
async function addField(){
  if(!val("fieldTitle") || !val("fieldBody")) return alert("상담 분야와 설명을 입력해 주세요.");
  await addDoc(collection(db,"fields"),{title:val("fieldTitle"),body:val("fieldBody"),createdAt:serverTimestamp()});
  setVal("fieldTitle"); setVal("fieldBody");
  alert("상담 분야가 등록되었습니다.");
  await loadAll();
}
async function addNotice(){
  if(!val("noticeTitle") || !val("noticeBody")) return alert("공지 제목과 내용을 입력해 주세요.");
  await addDoc(collection(db,"notices"),{tag:val("noticeTag")||"공지",title:val("noticeTitle"),body:val("noticeBody"),createdAt:serverTimestamp()});
  setVal("noticeTag"); setVal("noticeTitle"); setVal("noticeBody");
  alert("공지사항이 등록되었습니다.");
  await loadAll();
}
async function addDirectReview(){
  if(!val("reviewDirectName") || !val("reviewDirectBody")) return alert("이름과 후기 내용을 입력해 주세요.");
  const images = await uploadFiles($("reviewDirectImage")?.files, "reviews");
  await addDoc(collection(db,"reviews"),{
    name:val("reviewDirectName"),
    category:val("reviewDirectCategory"),
    stars:val("reviewDirectStars") || "★★★★★",
    body:val("reviewDirectBody"),
    image:images[0] || "",
    approved:true,
    createdAt:serverTimestamp()
  });
  setVal("reviewDirectName"); setVal("reviewDirectCategory"); setVal("reviewDirectBody");
  if($("reviewDirectImage")) $("reviewDirectImage").value="";
  alert("후기가 등록되었습니다.");
  await loadAll();
}

async function getList(colName){
  const s = await getDocs(query(collection(db,colName), orderBy("createdAt","desc")));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
function imgs(item){
  const arr = item.images || (item.image ? [item.image] : []);
  return arr.slice(0,3).map(src=>`<img class="thumb" src="${src}" alt="">`).join("");
}
async function fill(colName, boxId, html){
  const box=$(boxId);
  if(!box) return 0;
  try{
    const arr=await getList(colName);
    box.innerHTML = arr.map(html).join("") || "<p>등록된 내용이 없습니다.</p>";
    return arr.length;
  }catch(e){
    console.error(e);
    box.innerHTML = `<div class="errorBox">불러오기 실패: ${e.message}</div>`;
    return 0;
  }
}

async function loadAll(){
  await fill("consultPrices","consultAdminList", c=>`<div class="adminItem"><b>${c.title||""} · ${c.price||""}</b><p><span class="badge">${c.badge||"상담"}</span><br>${c.desc||""}</p><div class="actions"><button onclick="editConsult('${c.id}', '${String(c.title||"").replaceAll("'","\\'")}', '${String(c.price||"").replaceAll("'","\\'")}', '${String(c.badge||"").replaceAll("'","\\'")}', '${String(c.desc||"").replaceAll("'","\\'")}')">수정</button><button class="danger" onclick="del('consultPrices','${c.id}')">삭제</button></div></div>`);
  const orderCount = await fill("orders","orderAdminList", o=>`<div class="adminItem"><b>${o.name||""} · ${o.total||""}</b><p>${(o.items||[]).map(i=>`${i.name||""} ${i.qty||1}개`).join("<br>")}<br>연락처: ${o.contact||""}<br>주소: ${o.address||""}<br>결제: ${o.payment||"카카오페이 송금"}<br><span class="status">${o.status||"신규"}</span></p><div class="actions"><button onclick="setStatus('orders','${o.id}','입금완료')">입금완료</button><button onclick="setStatus('orders','${o.id}','진행중')">진행중</button><button onclick="setStatus('orders','${o.id}','완료')">완료</button><button onclick="del('orders','${o.id}')">삭제</button></div></div>`);
  const bookingCount = await fill("bookings","bookingAdminList", b=>`<div class="adminItem"><b>${b.name||""} · ${b.type||""}</b><p>${b.contact||""}<br>${b.date||""} ${b.time||""}<br>${b.body||""}<br><span class="status">${b.status||"대기"}</span></p><div class="actions"><button onclick="setStatus('bookings','${b.id}','확정')">확정</button><button onclick="setStatus('bookings','${b.id}','완료')">완료</button><button onclick="del('bookings','${b.id}')">삭제</button></div></div>`);
  const productCount = await fill("products","productAdminList", p=>`<div class="adminItem"><b>${p.name||""} · ${p.price||""}</b><p>${p.category||""} / ${p.stock||""}<br>${p.desc||""}</p>${imgs(p)}<div class="actions"><button onclick="del('products','${p.id}')">삭제</button></div></div>`);
  await fill("posts","postAdminList", p=>`<div class="adminItem"><b>${p.title||""}</b><p>${p.body||""}</p>${imgs(p)}<button onclick="del('posts','${p.id}')">삭제</button></div>`);
  await fill("fields","fieldAdminList", f=>`<div class="adminItem"><b>${f.title||""}</b><p>${f.body||""}</p><button onclick="del('fields','${f.id}')">삭제</button></div>`);
  await fill("notices","noticeAdminList", n=>`<div class="adminItem"><b>[${n.tag||"공지"}] ${n.title||""}</b><p>${n.body||""}</p><button onclick="del('notices','${n.id}')">삭제</button></div>`);

  let pendingCount=0, approvedCount=0;
  try{
    const allReviewsForPending=await getDocs(collection(db,"reviews"));
    const pendingDocs=allReviewsForPending.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(r=>r.approved===false)
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    pendingCount=pendingDocs.length;
    $("pendingReviewList").innerHTML = pendingDocs.map(r=>`<div class="adminItem"><b>${r.name||""} · ${r.category||""} · ${r.stars||""}</b><p>${r.body||""}</p>${r.image?`<img class="thumb" src="${r.image}">`:""}<div class="actions"><button onclick="approveReview('${r.id}')">승인</button><button onclick="del('reviews','${r.id}')">삭제</button></div></div>`).join("") || "<p>승인 대기 후기가 없습니다.</p>";
  }catch(e){ $("pendingReviewList").innerHTML=`<div class="errorBox">${e.message}</div>`; }
  try{
    const allReviewsForApproved=await getDocs(collection(db,"reviews"));
    const approvedDocs=allReviewsForApproved.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(r=>r.approved===true)
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    approvedCount=approvedDocs.length;
    $("approvedReviewList").innerHTML = approvedDocs.map(r=>`<div class="adminItem"><b>${r.name||""} · ${r.category||""} · ${r.stars||""}</b><p>${r.body||""}</p>${r.image?`<img class="thumb" src="${r.image}">`:""}<button onclick="del('reviews','${r.id}')">삭제</button></div>`).join("") || "<p>공개 후기가 없습니다.</p>";
  }catch(e){ $("approvedReviewList").innerHTML=`<div class="errorBox">${e.message}</div>`; }

  if($("statOrders")) $("statOrders").textContent=orderCount;
  if($("statBookings")) $("statBookings").textContent=bookingCount;
  if($("statProducts")) $("statProducts").textContent=productCount;
  if($("statReviews")) $("statReviews").textContent=pendingCount+approvedCount;
}

window.setStatus = async (colName,id,status)=>{ await updateDoc(doc(db,colName,id),{status}); await loadAll(); };
window.approveReview = async (id)=>{ await updateDoc(doc(db,"reviews",id),{approved:true}); await loadAll(); };
window.del = async (colName,id)=>{ if(confirm("삭제할까요?")){ await deleteDoc(doc(db,colName,id)); await loadAll(); } };

document.addEventListener("DOMContentLoaded", ()=>{
  bind("loginBtn", adminLogin);
  bind("logoutBtn", adminLogout);
  bind("savePaymentBtn", savePayment);
  bind("addConsultBtn", saveConsult);
  bind("resetConsultBtn", resetConsultForm);
  bind("addProductBtn", addProduct);
  bind("addPostBtn", addPost);
  bind("addFieldBtn", addField);
  bind("addNoticeBtn", addNotice);
  bind("addDirectReviewBtn", addDirectReview);
});
