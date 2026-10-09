/* ------------------------------------------------------------------
   Standalone mode. When this file is opened straight in a browser
   (not inside claude.ai) there is no window.claude, so this shim
   provides a local stand-in:
     - db:   a document store kept in this browser's localStorage.
             Tabs see each other's changes, so two tabs signed in as
             two different people can message and even call.
     - user: a simple local sign-in (a name, kept per tab).
   Claude-powered features (quiz writing, translation, AI replies)
   are not available here and hide themselves.
   ------------------------------------------------------------------ */
(function(){
  if(window.claude) return;
  var PREFIX="lc:";
  var LS=null, SS=null;
  try{ LS=window.localStorage; LS.setItem(PREFIX+"__probe","1"); LS.removeItem(PREFIX+"__probe"); }catch(e){ LS=null; }
  try{ SS=window.sessionStorage; }catch(e){ SS=null; }
  var mem={};  /* fallback when storage is blocked */
  function rawGet(k){ if(LS){ try{ return LS.getItem(k); }catch(e){} } return mem[k]==null?null:mem[k]; }
  function rawSet(k,v){ if(LS){ try{ LS.setItem(k,v); return; }catch(e){ throw {code:"quota_exceeded",message:"Browser storage is full."}; } } mem[k]=v; }
  function rawDel(k){ if(LS){ try{ LS.removeItem(k); }catch(e){} } delete mem[k]; }
  function allKeys(){
    var out=[];
    if(LS){ for(var i=0;i<LS.length;i++){ var k=LS.key(i); if(k&&k.indexOf(PREFIX)===0) out.push(k.slice(PREFIX.length)); } }
    else Object.keys(mem).forEach(function(k){ if(k.indexOf(PREFIX)===0) out.push(k.slice(PREFIX.length)); });
    return out;
  }
  function read(path){ var v=rawGet(PREFIX+path); if(v==null) return null; try{ return JSON.parse(v); }catch(e){ return null; } }
  function clone(x){ return x==null?x:JSON.parse(JSON.stringify(x)); }

  var listeners=[];
  var pending=false;
  function notify(){
    if(pending) return; pending=true;
    setTimeout(function(){ pending=false; listeners.slice().forEach(function(l){ try{ l(); }catch(e){ console.warn(e); } }); },0);
  }
  window.addEventListener("storage",function(e){ if(!e.key||e.key.indexOf(PREFIX)===0) notify(); });
  function addListener(run){
    listeners.push(run); setTimeout(run,0);
    return function(){ var i=listeners.indexOf(run); if(i>=0) listeners.splice(i,1); };
  }

  function snap(path){
    var d=read(path);
    return {exists:d!=null,id:path.split("/").pop(),data:function(){ return clone(d); }};
  }
  function doc(path){
    return {
      id:path.split("/").pop(), path:path,
      get:function(){ return Promise.resolve(snap(path)); },
      set:function(v){ rawSet(PREFIX+path,JSON.stringify(v)); notify(); return Promise.resolve(); },
      update:function(patch){ var cur=read(path)||{}; rawSet(PREFIX+path,JSON.stringify(Object.assign(cur,clone(patch)))); notify(); return Promise.resolve(); },
      delete:function(){ rawDel(PREFIX+path); notify(); return Promise.resolve(); },
      onSnapshot:function(fn){
        var last;
        return addListener(function(){
          var s=rawGet(PREFIX+path);
          if(s===last) return; last=s;
          fn(snap(path));
        });
      }
    };
  }
  function collection(name,filters){
    filters=filters||[];
    function docsNow(){
      return allKeys().filter(function(k){ var parts=k.split("/"); return parts.length===2&&parts[0]===name; })
        .map(function(k){ return {key:k,data:read(k)}; })
        .filter(function(x){ return x.data!=null&&filters.every(function(f){
          var v=x.data[f.field];
          if(f.op==="array-contains") return Array.isArray(v)&&v.indexOf(f.value)>=0;
          if(f.op==="==") return v===f.value;
          return true;
        }); });
    }
    return {
      where:function(field,op,value){ return collection(name,filters.concat([{field:field,op:op,value:value}])); },
      orderBy:function(){ return collection(name,filters); },
      limit:function(){ return collection(name,filters); },
      get:function(){ var d=docsNow(); return Promise.resolve({docs:d.map(function(x){ return {id:x.key.split("/")[1],data:function(){ return clone(x.data); }}; })}); },
      onSnapshot:function(fn){
        var last;
        return addListener(function(){
          var d=docsNow(), sig=JSON.stringify(d);
          if(sig===last) return; last=sig;
          fn({docs:d.map(function(x){ return {id:x.key.split("/")[1],data:function(){ return clone(x.data); }}; })});
        });
      }
    };
  }
  var db={doc:doc,collection:collection};

  /* ---- local sign-in ---- */
  function users(){ return read("__users")||{}; }
  function saveUser(u){ var all=users(); all[u.id]={name:u.name}; rawSet(PREFIX+"__users",JSON.stringify(all)); }
  function currentUser(){ try{ var v=SS&&SS.getItem("lc:me"); return v?JSON.parse(v):null; }catch(e){ return null; } }
  function setCurrent(u){ try{ SS&&SS.setItem("lc:me",JSON.stringify(u)); }catch(e){} }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  var signedIn=null;
  var whenSignedIn=new Promise(function(resolve){
    function done(u){ setCurrent(u); saveUser(u); signedIn=u; resolve(u); showSwitch(u); }
    var cur=currentUser();
    if(cur&&cur.id&&cur.name){ done(cur); return; }
    function show(){
      var all=users(), ids=Object.keys(all);
      var el=document.createElement("div");
      el.id="lc-signin";
      el.setAttribute("style","position:fixed;inset:0;z-index:90;background:var(--bg,#F5F7FA);display:grid;place-items:center;padding:16px;overflow:auto;");
      el.innerHTML='<div class="panel stack" style="max-width:420px;width:100%;">'+
        '<p class="eyebrow">LinguaConnect · standalone</p>'+
        '<h2 class="h-page">Who is using this browser tab?</h2>'+
        '<p class="sub">This copy runs entirely in your browser - no account needed. Everything is saved on this computer only.</p>'+
        (ids.length?'<div class="field"><label>Continue as</label><div class="stack" style="gap:6px;">'+ids.map(function(id){
          return '<button class="btn ghost block" data-lc-user="'+esc(id)+'" style="justify-content:flex-start;">'+esc(all[id].name)+'</button>'; }).join("")+'</div></div>'+
          '<hr class="rule">':"")+
        '<div class="field"><label for="lc-name">'+(ids.length?"Or sign in as someone new":"Your name")+'</label>'+
        '<input type="text" id="lc-name" maxlength="40" placeholder="e.g. Regina" autocomplete="name"></div>'+
        '<div class="err" id="lc-err" hidden>Type a name first.</div>'+
        '<button class="btn primary" id="lc-go">Continue</button>'+
        '<p class="sub" style="font-size:12.5px;">Tip: open this file in a second tab and sign in as a different person to try messages and calls between two people.</p>'+
      '</div>';
      document.body.appendChild(el);
      var go=function(){
        var name=(document.getElementById("lc-name").value||"").trim();
        if(!name){ document.getElementById("lc-err").hidden=false; return; }
        el.remove();
        done({id:"local_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:name.slice(0,40)});
      };
      document.getElementById("lc-go").onclick=go;
      document.getElementById("lc-name").onkeydown=function(e){ if(e.key==="Enter") go(); };
      el.querySelectorAll("[data-lc-user]").forEach(function(b){ b.onclick=function(){
        var id=b.getAttribute("data-lc-user"); el.remove(); done({id:id,name:all[id].name});
      }; });
      setTimeout(function(){ var i=document.getElementById("lc-name"); if(i&&!ids.length) i.focus(); },50);
    }
    if(document.body) show(); else document.addEventListener("DOMContentLoaded",show);
  });
  function showSwitch(u){
    function add(){
      var b=document.createElement("button");
      b.className="btn ghost sm";
      b.setAttribute("style","position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:30;box-shadow:var(--shadow-2);");
      b.textContent="Switch person";
      b.title="Signed in as "+u.name+" in this tab";
      b.onclick=function(){ try{ SS&&SS.removeItem("lc:me"); }catch(e){} location.reload(); };
      document.body.appendChild(b);
    }
    if(document.body) add(); else document.addEventListener("DOMContentLoaded",add);
  }

  var user={
    me:function(){ return whenSignedIn.then(function(u){ return {id:u.id,name:u.name,avatarUrl:"",color:"",isOwner:true}; }); },
    id:function(){ return whenSignedIn.then(function(u){ return u.id; }); },
    can:function(){ return Promise.resolve(true); },
    isOwner:function(){ return Promise.resolve(true); },
    canEdit:function(){ return Promise.resolve(true); },
    profiles:function(ids){
      var all=users(), out={};
      (ids||[]).forEach(function(id){ out[id]={id:id,name:(all[id]&&all[id].name)||"",avatarUrl:"",color:"",email:null}; });
      return Promise.resolve(out);
    },
    search:function(){ return Promise.resolve([]); }
  };

  window.claude={use:function(name){
    if(name==="db") return Promise.resolve(db);
    if(name==="user") return whenSignedIn.then(function(){ return user; });
    return Promise.resolve(null);
  }};
})();
