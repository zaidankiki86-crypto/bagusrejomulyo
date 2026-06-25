const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, 'style.css');
const dataPath = path.join(__dirname, 'data.js');
const appPath = path.join(__dirname, 'app.js');
const xmlPath = path.join(__dirname, 'siternak-blogger-template.xml');

try {
  console.log("Reading source files...");
  const styleCss = fs.readFileSync(stylePath, 'utf8');
  const dataJs = fs.readFileSync(dataPath, 'utf8');
  const appJs = fs.readFileSync(appPath, 'utf8');

  console.log("Generating Blogger XML Template...");
  const xmlTemplate = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:css='false' b:js='true' html5='true' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head>
  <meta charset='utf-8'/>
  <meta content='width=device-width, initial-scale=1' name='viewport'/>
  <title><data:blog.pageTitle/></title>
  
  <!-- Premium Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=Outfit:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
  
  <!-- Chart.js CDN for Sheep Price Monitoring Charts -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js" type="text/javascript"></script>

  <!-- Blogger Skin CSS (Required by Blogger theme compiler) -->
  <b:skin><![CDATA[
  /* Blogger default skins */
  ]]></b:skin>
  
  <!-- SITernak Custom CSS Stylesheet -->
  <style type='text/css'>
    /*<![CDATA[*/
${styleCss}
    /*]]>*/
  </style>
</head>
<body>

  <!-- SITernak Core Application HTML -->
  <div class='app-container' id='app'>
    <!-- Overlay for mobile/tablet navigation drawer -->
    <div class='drawer-overlay' id='drawer-overlay' onclick='toggleMobileMenu(false)'></div>
    
    <!-- Navigation Sidebar (Desktop) / Sliding Nav Drawer (Mobile/Tablet) -->
    <aside class='sidebar' id='sidebar'></aside>
    
    <!-- Main content wrapper -->
    <div class='main-wrapper'>
      <header class='top-header'>
        <div class='header-left'>
          <!-- Animated Hamburger Button (Visible only on mobile/tablet) -->
          <button class='hamburger-btn' id='hamburger-toggle-btn' onclick='toggleMobileMenu()' aria-label='Toggle Menu'>
            <span class='bar line-1'></span>
            <span class='bar line-2'></span>
            <span class='bar line-3'></span>
          </button>
          
          <div class='header-branding'>
            <span class='mobile-logo-icon'>🐑</span>
            <div class='title-meta'>
              <h1>SITernak Bagus Rejo Mulyo</h1>
              <p class='subtitle'>Bagusan RT 02 RW 07, Sendangijo, Selogiri, Wonogiri, Jawa Tengah</p>
            </div>
          </div>
        </div>
        
        <div class='header-actions'>
          <div class='current-date-badge' id='header-date'>
            <span class='icon'>📅</span>
            <span class='text' id='header-date-text'>24 Juni 2026</span>
          </div>
        </div>
      </header>
      
      <!-- Dynamic page content will be injected here -->
      <main class='content-container' id='main-content'></main>
    </div>
  </div>

  <!-- Reusable Modal Container -->
  <div class='modal-backdrop' id='form-modal' style='display: none;'>
    <div class='modal-card'>
      <div class='modal-header'>
        <h3 id='modal-title'>Form Tambah</h3>
        <button class='modal-close' onclick='closeModal()'>×</button>
      </div>
      <div class='modal-body' id='modal-body-content'>
        <!-- Form injected dynamically -->
      </div>
    </div>
  </div>

  <!-- Reusable Detail View Modal Container (for Livestock Detail Tabs) -->
  <div class='modal-backdrop' id='detail-modal' style='display: none;'>
    <div class='modal-card modal-card-large'>
      <div class='modal-header'>
        <h3 id='detail-modal-title'>Detail Domba</h3>
        <button class='modal-close' onclick='closeDetailModal()'>×</button>
      </div>
      <div class='modal-body' id='detail-modal-body-content'>
        <!-- Detail content with tabs injected dynamically -->
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class='toast-container' id='toast-container'></div>

  <!-- Required Blogger layouts section (compiles theme) -->
  <div style='display: none;'>
    <b:section id='main-blogger-layout' showaddelement='yes'>
      <b:widget id='Header1' locked='true' title='Header' type='Header' version='1'>
        <b:includable id='main'>
          <!-- Empty layout widget -->
        </b:includable>
      </b:widget>
    </b:section>
  </div>

  <!-- SITernak JS Engine (Combined data.js & app.js) -->
  <script type='text/javascript'>
    //<![CDATA[
${dataJs}

${appJs}
    //]]>
  </script>
</body>
</html>`;

  fs.writeFileSync(xmlPath, xmlTemplate, 'utf8');
  console.log("Successfully compiled siternak-blogger-template.xml! 🐑🚀");

  // Output standalone script block file to prevent chat truncation issues
  const scriptContent = `//<![CDATA[\n${dataJs}\n\n${appJs}\n//]]>`;
  fs.writeFileSync(path.join(__dirname, 'siternak-blogger-script-block.js'), scriptContent, 'utf8');
  console.log("Successfully generated siternak-blogger-script-block.js! 📝🐑");
} catch (err) {
  console.error("Compilation failed:", err.message);
  process.exit(1);
}
