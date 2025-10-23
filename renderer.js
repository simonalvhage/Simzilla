window.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const edge = document.getElementById("edge");
  const tabsEl = document.getElementById("tabs");
  const address = document.getElementById("address");
  const container = document.getElementById("webview-container");

  // --- State ---
  const state = {
    tabs: [],
    currentId: null,
    homepage: "https://www.google.com"
  };

  const currentTab = () => state.tabs.find(t => t.id === state.currentId);

  // --- Helpers ---
  function toUrl(s) {
    s = (s || "").trim();
    if (!s) return state.homepage;
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.includes(".") && !s.includes(" ")) return "https://" + s;
    return "https://www.google.com/search?q=" + encodeURIComponent(s);
  }

  function faviconFor(u) {
    try { 
      const url = new URL(u);
      return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
    } catch { 
      return ""; 
    }
  }

  // --- Sidebar auto-hide ---
  let hideTimer;
  edge.addEventListener("mouseenter", () => {
    clearTimeout(hideTimer);
    sidebar.classList.add("open");
  });
  sidebar.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(() => sidebar.classList.remove("open"), 400);
  });

  // --- Tabs ---
  function renderTabs() {
    tabsEl.innerHTML = "";
    for (const t of state.tabs) {
      const el = document.createElement("div");
      el.className = "tab" + (t.id === state.currentId ? " active" : "");
      
      const img = document.createElement("img");
      img.src = t.fav || faviconFor(t.url) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect fill='%23666' width='16' height='16'/%3E%3C/svg%3E";
      img.onerror = () => {
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect fill='%23666' width='16' height='16'/%3E%3C/svg%3E";
      };
      
      const span = document.createElement("span");
      span.textContent = t.title || "Ny flik";
      span.title = t.title || "Ny flik";
      
      const x = document.createElement("div");
      x.textContent = "✕";
      x.className = "x";
      x.onclick = e => { 
        e.stopPropagation(); 
        closeTab(t.id); 
      };
      
      el.onclick = () => activateTab(t.id);
      el.append(img, span, x);
      tabsEl.appendChild(el);
    }
  }

  function createTab(url) {
    const id = crypto.randomUUID();
    const view = document.createElement("webview");
    
    // Sätt src DIREKT som attribut
    view.src = toUrl(url);
    view.setAttribute("allowpopups", "");
    view.setAttribute("allowfullscreen", "");
    view.setAttribute("disablewebsecurity", "");
    view.setAttribute("partition", "persist:simzilla");
    view.setAttribute("useragent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    view.style.display = "none";
    
    container.appendChild(view);

    const tab = { 
      id, 
      view, 
      title: "Ny flik", 
      url: toUrl(url), 
      fav: "" 
    };
    state.tabs.push(tab);

    // Event listeners
    view.addEventListener("did-start-loading", () => {
      console.log("Started loading:", view.src);
      tab.title = "Laddar...";
      renderTabs();
    });

    view.addEventListener("did-stop-loading", () => {
      console.log("Stopped loading:", view.src);
      updateFromView();
    });

    view.addEventListener("did-finish-load", () => {
      console.log("Finished loading:", view.src);
      updateFromView();
    });

    view.addEventListener("did-navigate", (e) => {
      console.log("Navigated to:", e.url);
      updateFromView();
    });

    view.addEventListener("did-navigate-in-page", (e) => {
      console.log("Navigated in page:", e.url);
      updateFromView();
    });

    view.addEventListener("page-title-updated", (e) => {
      console.log("Title updated:", e.title);
      tab.title = e.title || tab.url || "Ny flik";
      if (tab.id === state.currentId) {
        address.value = tab.url;
      }
      renderTabs();
    });

    view.addEventListener("did-fail-load", (e) => {
      if (e.errorCode !== -3) {
        console.error("Failed to load:", e.errorCode, e.errorDescription, e.validatedURL);
        tab.title = `Fel: ${e.errorDescription}`;
        renderTabs();
      }
    });

    view.addEventListener("console-message", (e) => {
      console.log("Guest console:", e.message);
    });

    view.addEventListener("dom-ready", () => {
      console.log("DOM ready for:", view.src);
      updateFromView();
    });

    function updateFromView() {
      try {
        const newUrl = view.getURL();
        console.log("Current URL:", newUrl);
        
        if (newUrl && !newUrl.startsWith("chrome-error://")) {
          tab.url = newUrl;
          const title = view.getTitle();
          tab.title = title || newUrl || "Ny flik";
          tab.fav = faviconFor(tab.url);
          
          if (tab.id === state.currentId) {
            address.value = tab.url;
          }
          renderTabs();
          updateNavButtons();
        }
      } catch (err) {
        console.error("Error updating from view:", err);
      }
    }

    activateTab(id);
  }

  function activateTab(id) {
    state.currentId = id;
    for (const t of state.tabs) {
      if (t.id === id) {
        t.view.style.display = "block";
      } else {
        t.view.style.display = "none";
      }
    }
    const t = currentTab();
    if (t) {
      address.value = t.url || "";
    }
    renderTabs();
    updateNavButtons();
  }

  function closeTab(id) {
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx < 0) return;
    
    const wasCurrent = state.currentId === id;
    state.tabs[idx].view.remove();
    state.tabs.splice(idx, 1);
    
    if (state.tabs.length === 0) {
      createTab(state.homepage);
    } else if (wasCurrent) {
      const nextIdx = Math.min(idx, state.tabs.length - 1);
      activateTab(state.tabs[nextIdx].id);
    } else {
      renderTabs();
    }
  }

  // --- Navigation ---
  function goBack() {
    const t = currentTab();
    if (!t) return;
    try {
      if (t.view.canGoBack()) {
        t.view.goBack();
      }
    } catch (err) {
      console.error("Error going back:", err);
    }
  }

  function goForward() {
    const t = currentTab();
    if (!t) return;
    try {
      if (t.view.canGoForward()) {
        t.view.goForward();
      }
    } catch (err) {
      console.error("Error going forward:", err);
    }
  }

  function reload() {
    const t = currentTab();
    if (!t) return;
    try {
      t.view.reload();
    } catch (err) {
      console.error("Error reloading:", err);
    }
  }

  function navigate(input) {
    const t = currentTab();
    if (!t) return;
    try {
      const url = toUrl(input);
      console.log("Navigating to:", url);
      t.view.loadURL(url);
    } catch (err) {
      console.error("Error navigating:", err);
    }
  }

  // --- Update buttons ---
  function updateNavButtons() {
    const t = currentTab();
    if (!t) return;
    try {
      document.getElementById("back").disabled = !t.view.canGoBack();
      document.getElementById("forward").disabled = !t.view.canGoForward();
    } catch (err) {
      console.error("Error updating nav buttons:", err);
    }
  }

  // --- UI events ---
  document.getElementById("back").onclick = goBack;
  document.getElementById("forward").onclick = goForward;
  document.getElementById("reload").onclick = reload;
  document.getElementById("newtab").onclick = () => createTab(state.homepage);
  
  address.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      navigate(address.value);
      address.blur();
    }
  });

  // Tangentbordsgenvägar
  document.addEventListener("keydown", e => {
    // Fokusera adressfält
    if ((e.ctrlKey || e.metaKey) && e.key === "l") {
      e.preventDefault();
      address.select();
    }
    
    // Ny flik
    if ((e.ctrlKey || e.metaKey) && e.key === "t") {
      e.preventDefault();
      createTab(state.homepage);
    }
    
    // Stäng flik
    if ((e.ctrlKey || e.metaKey) && e.key === "w") {
      e.preventDefault();
      const t = currentTab();
      if (t) closeTab(t.id);
    }

    // Bakåt
    if ((e.altKey && e.key === "ArrowLeft") || (e.metaKey && e.key === "[")) {
      e.preventDefault();
      goBack();
    }

    // Framåt
    if ((e.altKey && e.key === "ArrowRight") || (e.metaKey && e.key === "]")) {
      e.preventDefault();
      goForward();
    }

    // Uppdatera
    if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "r")) {
      e.preventDefault();
      reload();
    }
  });

  // --- Init ---
  console.log("SimZilla starting...");
  sidebar.classList.add("open");
  createTab(state.homepage);
});