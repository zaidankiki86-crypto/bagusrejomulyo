/**
 * data.js - Vercel API Gateway Client
 * Sistem Informasi Ternak Bagus Rejo Mulyo
 * Sinkronisasi data via REST API hosted on Vercel
 */

// Connection settings: Points to local server when testing locally, otherwise points to Vercel production API
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://bagusrejomulyo.vercel.app';

// Client Cache Variables
let cachedMembers = [];
let cachedLivestock = [];
let cachedTransactions = [];
let cachedDues = [];
let cachedActivities = [];
let syncVersion = 0;
let isServerConnected = true;

// Helper function: API REST request wrapper
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);
  
  const response = await fetch(API_URL + endpoint, config);
  if (!response.ok) {
    let errMsg = "Terjadi kesalahan server";
    try {
      const errData = await response.json();
      errMsg = errData.message || errMsg;
    } catch(e) {}
    throw new Error(errMsg);
  }
  return await response.json();
}

// Fetch all database tables to local memory cache
async function forceSync(targetVersion) {
  try {
    const response = await fetch(API_URL + '/api/all-data');
    if (!response.ok) throw new Error("Gagal mengambil data sinkronisasi.");
    const data = await response.json();
    
    cachedMembers = data.members;
    cachedLivestock = data.livestock;
    cachedTransactions = data.transactions;
    cachedDues = data.dues;
    cachedActivities = data.activities;
    syncVersion = data.version;
    
    // Trigger current page refresh if a sync version increment occurred
    if (targetVersion && typeof router === 'function') {
      router();
    }
  } catch (err) {
    console.error("forceSync failed:", err);
  }
}

// Offline Connection Status Warnings
function showConnectionError() {
  let banner = document.getElementById("offline-sync-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "offline-sync-banner";
    banner.style.backgroundColor = "#D97706"; // Amber 600
    banner.style.color = "#FFFFFF";
    banner.style.textAlign = "center";
    banner.style.padding = "10px 16px";
    banner.style.fontSize = "0.85rem";
    banner.style.fontWeight = "700";
    banner.style.position = "sticky";
    banner.style.top = "70px"; // Fixed below header (70px height)
    banner.style.zIndex = "99";
    banner.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
    banner.style.display = "flex";
    banner.style.alignItems = "center";
    banner.style.justifyContent = "center";
    banner.style.gap = "8px";
    
    banner.innerHTML = `
      <span>⚠️</span>
      <span>Terputus dari database pusat. Mode baca-saja aktif. Hubungkan kembali untuk menyimpan perubahan...</span>
      <span class="connection-pulse"></span>
    `;

    // Inject connection warning banner directly between header and maincontent
    const header = document.querySelector(".top-header");
    if (header) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    }
    
    // Add pulsing CSS animation to banner inline dynamically
    if (!document.getElementById("pulse-animation-style")) {
      const style = document.createElement("style");
      style.id = "pulse-animation-style";
      style.innerHTML = `
        .connection-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: white;
          animation: pulseFade 1.5s infinite;
        }
        @keyframes pulseFade {
          0% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.2; transform: scale(0.8); }
        }
      `;
      document.head.appendChild(style);
    }
  }
}

function hideConnectionError() {
  const banner = document.getElementById("offline-sync-banner");
  if (banner) banner.remove();
}

// Background sync heartbeat checker loop
async function checkSync() {
  try {
    const response = await fetch(API_URL + '/api/sync-status');
    if (!response.ok) throw new Error();
    const status = await response.json();
    
    if (!isServerConnected) {
      isServerConnected = true;
      hideConnectionError();
      if (typeof showToast === 'function') {
        showToast("Kembali terhubung ke database pusat! 🐑", "success");
      }
    }
    
    if (status.version !== syncVersion) {
      await forceSync(status.version);
    }
  } catch (err) {
    if (isServerConnected) {
      isServerConnected = false;
      showConnectionError();
      if (typeof showToast === 'function') {
        showToast("Terputus dari database pusat. Mode baca-saja aktif.", "danger");
      }
    }
  }
}

// Initialize boot data load
(async function initSync() {
  await forceSync();
  setInterval(checkSync, 3000);
})();

// ==========================================================================
// CENTRAL DATABASE GATEWAY API MAPPERS
// ==========================================================================
window.Database = {
  getMembers: () => cachedMembers,
  getLivestock: () => cachedLivestock,
  getTransactions: () => cachedTransactions,
  getDues: () => cachedDues,
  getActivities: () => cachedActivities,
  
  getLivestockByOwner: (ownerId) => {
    return cachedLivestock.filter(s => s.ownerId === ownerId);
  },
  
  getHealthLogs: () => {
    const allLogs = [];
    cachedLivestock.forEach(s => {
      if (s.health) {
        s.health.forEach(h => {
          allLogs.push({
            ...h,
            sheepId: s.id,
            sheepName: s.name,
            ownerId: s.ownerId
          });
        });
      }
    });
    return allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  
  // Setters write asynchronously to Central Backend Server and refresh local cache
  addMember: async (member) => {
    await apiRequest('/api/members', 'POST', member);
    await forceSync();
  },
  updateMember: async (updated) => {
    await apiRequest(`/api/members/${updated.id}`, 'PUT', updated);
    await forceSync();
  },
  deleteMember: async (id) => {
    await apiRequest(`/api/members/${id}`, 'DELETE');
    await forceSync();
  },
  
  addLivestock: async (animal) => {
    const id = "SHP-" + Date.now() + Math.floor(Math.random() * 100);
    const result = await apiRequest('/api/livestock', 'POST', { id, ...animal });
    await forceSync();
    return result.id;
  },
  updateLivestock: async (updated) => {
    await apiRequest(`/api/livestock/${updated.id}`, 'PUT', updated);
    await forceSync();
  },
  deleteLivestock: async (id) => {
    await apiRequest(`/api/livestock/${id}`, 'DELETE');
    await forceSync();
  },
  
  addGrowthLog: async (sheepId, record) => {
    await apiRequest(`/api/livestock/${sheepId}/growth`, 'POST', record);
    await forceSync();
  },
  
  addHealthLog: async (sheepId, record) => {
    await apiRequest(`/api/livestock/${sheepId}/health`, 'POST', record);
    await forceSync();
  },
  deleteHealthLog: async (sheepId, logId) => {
    await apiRequest(`/api/livestock/${sheepId}/health/${logId}`, 'DELETE');
    await forceSync();
  },
  
  addTransaction: async (tx) => {
    await apiRequest('/api/transactions', 'POST', tx);
    await forceSync();
  },
  deleteTransaction: async (id) => {
    await apiRequest(`/api/transactions/${id}`, 'DELETE');
    await forceSync();
  },
  
  updateDuesStatus: async (memberId, field, val) => {
    await apiRequest(`/api/dues/${memberId}`, 'PUT', { field, val });
    await forceSync();
  },
  
  addActivity: async (act) => {
    const id = "ACT-" + Date.now();
    await apiRequest('/api/activities', 'POST', { id, ...act });
    await forceSync();
  },
  updateActivity: async (updated) => {
    await apiRequest(`/api/activities/${updated.id}`, 'PUT', updated);
    await forceSync();
  },
  deleteActivity: async (id) => {
    await apiRequest(`/api/activities/${id}`, 'DELETE');
    await forceSync();
  }
};
