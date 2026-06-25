$styleCss = Get-Content -Raw -Encoding utf8 style.css
$dataJs = Get-Content -Raw -Encoding utf8 data.js
$appJs = Get-Content -Raw -Encoding utf8 app.js

$xmlTemplate = @"
<?xml version="1.0" encoding="UTF-8" ?>
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
$styleCss
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
            <span class='mobile-logo-icon'>&#128017;</span>
            <div class='title-meta'>
              <h1>SITernak Bagus Rejo Mulyo</h1>
              <p class='subtitle'>Bagusan RT 02 RW 07, Sendangijo, Selogiri, Wonogiri, Jawa Tengah</p>
            </div>
          </div>
        </div>
        
        <div class='header-actions'>
          <div class='current-date-badge' id='header-date'>
            <span class='icon'>&#128197;</span>
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
        <button class='modal-close' onclick='closeModal()'>X</button>
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
        <button class='modal-close' onclick='closeDetailModal()'>X</button>
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
$dataJs

$appJs
    //]]>
  </script>
</body>
</html>
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$(pwd)\siternak-blogger-template.xml", $xmlTemplate, $utf8NoBom)
Write-Host "Successfully compiled siternak-blogger-template.xml!"

$scriptContent = "//<![CDATA[`n$dataJs`n`n$appJs`n//]]>"
[System.IO.File]::WriteAllText("$(pwd)\siternak-blogger-script-block.js", $scriptContent, $utf8NoBom)
Write-Host "Successfully generated siternak-blogger-script-block.js!"
