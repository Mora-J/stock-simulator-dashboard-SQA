// --- DICCIONARIO DE TRAZABILIDAD ---
const UNIT_TEST_DESCRIPTIONS = {
    'StockSimulatorApplicationTests': { cp: 'N/A', sub: 'Configuración', prio: 'Baja', desc: 'Verificación básica del contexto de Spring.' },
    'StockControllerResponseWrapperTest': { cp: 'CP-11', sub: 'Pertinencia Funcional', prio: 'Baja', desc: 'Evalúa la estructura de respuesta unificada StockListResponseDTO.' },
    'TransactionControllerInsufficientBalanceTest': { cp: 'CP-09', sub: 'Corrección Funcional', prio: 'Alta', desc: 'Verifica el rechazo de sobregiros antes de persistir.' },
    'UserControllerDuplicateUsernameTest': { cp: 'CP-10', sub: 'Corrección Funcional', prio: 'Media', desc: 'Asegura respuesta 409 Conflict ante usuarios duplicados.' },
    'BuyRequestDTOTest': { cp: 'CP-01', sub: 'Completitud Funcional', prio: 'Alta', desc: 'Verifica la validación de entrada de datos en la compra.' },
    'SellRequestDTOTest': { cp: 'CP-02', sub: 'Completitud Funcional', prio: 'Media', desc: 'Garantiza validación de campos obligatorios en venta.' },
    'OwnedStockNegativeBalanceTest': { cp: 'CP-06', sub: 'Corrección Funcional', prio: 'Alta', desc: 'Audita la aritmética de inventario para evitar negativos.' },
    'TransactionAmountRoundingTest': { cp: 'CP-05', sub: 'Corrección Funcional', prio: 'Alta', desc: 'Evalúa precisión financiera evitando redondeo binario.' },
    'SecurityConfigurationJwtTest': { cp: 'CP-12', sub: 'Pertinencia Funcional', prio: 'Alta', desc: 'Confirma protección de rutas ante acceso anónimo.' },
    'StockEODServiceTimeoutTest': { cp: 'CP-07', sub: 'Corrección Funcional', prio: 'Alta', desc: 'Asegura manejo de excepciones ante timeout de red.' },
    'StockServiceMapToDTOTest': { cp: 'CP-08', sub: 'Corrección Funcional', prio: 'Media', desc: 'Verifica la exactitud del mapeo de datos al DTO.' },
    'TransactionServiceVerifyVisaTest': { cp: 'CP-03', sub: 'Completitud Funcional', prio: 'Alta', desc: 'Garantiza validación segura de tarjetas VISA.' },
    'UserServiceRegisterPasswordHashTest': { cp: 'CP-04', sub: 'Completitud Funcional', prio: 'Alta', desc: 'Verifica cifrado seguro de credenciales.' },
    'PasswordUtilMatchesTest': { cp: 'CP-13', sub: 'Pertinencia Funcional', prio: 'Media', desc: 'Valida la coincidencia de claves seguras.' }
};

const INTEGRATION_TEST_DESCRIPTIONS = {
    'CP-08': { name: 'Inyección SQL en Búsqueda', desc: 'Evalúa la persistencia ante payloads maliciosos.' },
    'CP-11': { name: 'Consultar Mercado', desc: 'Verifica el contrato de respuesta del endpoint /all.' },
    'CP-36': { name: 'Transferencia sin Token', desc: 'Valida la protección contra acceso anónimo.' },
    'CP-49': { name: 'Doble Clic (Carrera)', desc: 'Evalúa aislamiento ante peticiones concurrentes.' },
    'CP-50': { name: 'Transferencia Cíclica', desc: 'Prohíbe transferencias bursátiles al mismo emisor.' }
};
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const showDashboardBtn = document.getElementById('show-dashboard');
    const showReportsBtn = document.getElementById('show-reports');
    const dashboardView = document.getElementById('dashboard-view');
    const reportsView = document.getElementById('reports-view');
    const metricsGrid = document.getElementById('metrics-grid');
    
    // --- MANEJO DE PESTAÑAS ---
    showDashboardBtn.addEventListener('click', () => {
        dashboardView.classList.add('active');
        reportsView.classList.remove('active');
        showDashboardBtn.classList.add('active');
        showReportsBtn.classList.remove('active');
    });

    showReportsBtn.addEventListener('click', () => {
        reportsView.classList.add('active');
        dashboardView.classList.remove('active');
        showReportsBtn.classList.add('active');
        showDashboardBtn.classList.remove('active');
    });

    // --- INTERCEPTOR Y PARSER DE REPORTES CRUDOS ---
    document.getElementById('report-select').addEventListener('change', async (event) => {
        const filePath = event.target.value;
        const dynamicTables = document.getElementById('report-dynamic-tables');
        const summaryHeader = document.getElementById('report-summary-header');
        
        if (!filePath) {
            summaryHeader.innerHTML = '';
            dynamicTables.innerHTML = '<p class="placeholder-text">Seleccione un reporte para auditar la casuística de fallas detallada.</p>';
            return;
        }
        
        dynamicTables.innerHTML = '<p class="placeholder-text">Interpretando y dando formato al reporte de QA...</p>';
        const fileContent = await fetchFile(filePath);
        
        if (!fileContent) {
            dynamicTables.innerHTML = `<p class="error" style="color:var(--error-color)">No se pudo recuperar el artefacto de la ruta: ${filePath}</p>`;
            return;
        }

        summaryHeader.innerHTML = `<div class="report-badge badge-success">Archivo: ${filePath.split('/').pop()}</div>`;

        // 1. NIVEL 1: PRUEBAS UNITARIAS (SUREFIRE XML)
        if (filePath.includes('surefire')) {
            interpretSurefireXml(fileContent, dynamicTables);
        } 
        // 2. NIVEL 2: PRUEBAS DE INTEGRACIÓN (NEWMAN JSON)
        else if (filePath.includes('newman')) {
            interpretNewmanJson(fileContent, dynamicTables);
        } 
        // 3. NIVEL 3 Y 4: PRUEBAS DE SISTEMA Y ACEPTACIÓN (CYPRESS / MOCHAWESOME)
        else if (filePath.includes('cypress')) {
            interpretCypressJson(fileContent, dynamicTables, filePath);
        }
        // Fallback para los archivos de métricas que también están en el selector
        else if (filePath.endsWith('.json')) {
            try {
                // Usamos el formato de tabla para mantener la consistencia visual
                dynamicTables.innerHTML = `<pre class="trace-block" style="color: var(--text-primary); background-color: #111827;">${JSON.stringify(JSON.parse(fileContent), null, 2)}</pre>`;
            } catch(e) {
                dynamicTables.innerHTML = `<p class="error" style="color:var(--error-color)">Error parseando JSON: ${e.message}</p>`;
            }
        }
    });

    initializeDashboard();
});

// --- RUTAS DE ARCHIVOS ---
const FILE_PATHS = {
    backendMetrics: 'backend-data/metrics/backend-metrics-governance.json', // Ruta corregida
    frontendMetrics: 'frontend-data/metrics/frontend-metrics-governance.json', // Ruta corregida
    newmanReport: 'backend-data/reports/newman/newman-report.json', // Ruta corregida
    cypressReport: 'frontend-data/reports/cypress/cypress-report-merged.json', // Ruta corregida
    surefireReports: [
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.controller.StockControllerResponseWrapperTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.controller.TransactionControllerInsufficientBalanceTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.controller.UserControllerDuplicateUsernameTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.dto.request.BuyRequestDTOTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.dto.request.SellRequestDTOTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.model.OwnedStockNegativeBalanceTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.model.TransactionAmountRoundingTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.security.SecurityConfigurationJwtTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.service.StockEODServiceTimeoutTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.service.StockServiceMapToDTOTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.service.TransactionServiceVerifyVisaTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.service.UserServiceRegisterPasswordHashTest.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-ucab.edu.ve.stocksimulator.StockSimulatorApplicationTests.xml', // Ruta corregida
        'backend-data/reports/surefire/TEST-util.PasswordUtilMatchesTest.xml' // Ruta corregida
    ]
};

async function initializeDashboard() {
    console.log("Inicializando el dashboard...");
    await loadMetrics();
    await setupReportSelector();
}

// Variable global para destruir el gráfico anterior al abrir uno nuevo
let currentChart = null;

// (Tus EventListeners iniciales y FILE_PATHS se mantienen igual hasta la función loadMetrics)
// ... [Manten tu bloque superior idéntico]

async function loadMetrics() {
    console.log("Cargando y calculando métricas...");
    const metricsGrid = document.getElementById('metrics-grid');
    metricsGrid.innerHTML = ''; 

    try {
        const [backendMetricsData, frontendMetricsData, newmanReportData, cypressReportData, surefireReportsData] = await Promise.all([
            fetchFile(FILE_PATHS.backendMetrics).then(text => text ? JSON.parse(text) : null),
            fetchFile(FILE_PATHS.frontendMetrics).then(text => text ? JSON.parse(text) : null),
            fetchFile(FILE_PATHS.newmanReport).then(text => text ? JSON.parse(text) : null),
            fetchFile(FILE_PATHS.cypressReport).then(text => text ? JSON.parse(text) : null),
            Promise.all(FILE_PATHS.surefireReports.map(path => fetchFile(path)))
        ]);

        if (!backendMetricsData || !frontendMetricsData) throw new Error("JSONs de métricas no encontrados.");

        // --- Nivel 1: Cobertura de Código ---
        const codeCoverage = Math.min(100, backendMetricsData.coverage_percent || 0);
        renderMetricCard(
            'Cobertura de Código (Backend)', `${codeCoverage.toFixed(2)}%`, 
            'Porcentaje de líneas críticas ejecutadas por pruebas unitarias.',
            {
                breakdown: [
                    { label: 'Fórmula', value: '(Líneas Cubiertas / Totales) * 100' },
                    { label: 'Porcentaje Cubierto', value: `${codeCoverage}%` }
                ],
                chart: { labels: ['Cubierto', 'No Cubierto'], data: [codeCoverage, Math.max(0, 100 - codeCoverage)], colors: ['#34d399', '#f87171'] }
            }
        );

        // --- Nivel 1: Éxito y Defectos Unitarios ---
        const unitPassRate = Math.min(100, backendMetricsData.unit_test_success_rate_percent || 0);
        const unitDefectDensity = backendMetricsData.defect_density_unitarias || 0;
        
        renderMetricCard(
            'Tasa de Éxito Unitario', `${unitPassRate.toFixed(2)}%`, 
            'Porcentaje de pruebas unitarias que pasaron con éxito.',
            {
                breakdown: [
                    { label: 'Pruebas Totales', value: backendMetricsData.surefire_tests_total },
                    { label: 'Pruebas Fallidas/Errores', value: backendMetricsData.surefire_failures_total },
                    { label: 'Pruebas Saltadas', value: backendMetricsData.surefire_skipped_total }
                ],
                chart: { 
                    labels: ['Exitosas', 'Fallidas', 'Saltadas'], 
                    data: [Math.max(0, backendMetricsData.surefire_tests_total - backendMetricsData.surefire_failures_total - backendMetricsData.surefire_skipped_total), backendMetricsData.surefire_failures_total, backendMetricsData.surefire_skipped_total], 
                    colors: ['#34d399', '#f87171', '#fbbf24'] 
                }
            }
        );

        renderMetricCard(
            'Densidad de Defectos Unitarios', unitDefectDensity.toFixed(3), 
            'Número de defectos por cada clase probada.',
            {
                breakdown: [
                    { label: 'Defectos Totales Detectados', value: backendMetricsData.surefire_failures_total },
                    { label: 'Clases Probadas', value: backendMetricsData.surefire_classes_total },
                    { label: 'Fórmula', value: 'Defectos / Clases' }
                ],
                chart: null // No aplica gráfico de torta para densidad
            }
        );

// --- Nivel 2: Pruebas de Integración (Backend - Newman) ---
        // Tomamos los valores YA CALCULADOS por tu script de gobernanza
        const apiPassRate = backendMetricsData.api_pass_rate_percent || 0;
        const apiDefectDensity = backendMetricsData.api_defect_density || 0;
        
        // Calcular aserciones exitosas para el desglose y el gráfico
        const asercionesTotales = backendMetricsData.newman_assertions_total || 0;
        const asercionesFallidas = backendMetricsData.newman_assertions_failed || 0;
        const asercionesExitosas = asercionesTotales - asercionesFallidas;

        renderMetricCard(
            'Tasa de Éxito de API', 
            `${apiPassRate}%`, 
            'Porcentaje de aserciones de API que respondieron correctamente.',
            {
                breakdown: [
                    { label: 'Aserciones Totales', value: asercionesTotales },
                    { label: 'Aserciones Fallidas', value: asercionesFallidas },
                    { label: 'Aserciones Exitosas', value: asercionesExitosas }
                ],
                chart: { 
                    labels: ['Exitosas', 'Fallidas'], 
                    data: [asercionesExitosas, asercionesFallidas], 
                    colors: ['#38bdf8', '#f87171'] 
                }
            }
        );

        renderMetricCard(
            'Densidad de Defectos API', 
            apiDefectDensity.toFixed(3), 
            'Proporción de aserciones fallidas en la capa de servicios.',
            {
                breakdown: [
                    { label: 'Aserciones Fallidas', value: asercionesFallidas },
                    { label: 'Aserciones Totales', value: asercionesTotales },
                    { label: 'Fórmula', value: 'Fallidas / Totales' }
                ],
                chart: null // Dejamos el gráfico en null porque la densidad se explica mejor solo con los números
            }
        );

        // --- Nivel 3: Pruebas E2E (Cypress) ---
        const e2ePassRate = Math.min(100, frontendMetricsData.metrics.e2ePassRatePercent.value || 0);
        const blackBoxFailureDensity = frontendMetricsData.metrics.blackBoxFailureDensity.value || 0;

        renderMetricCard(
            'Tasa de Éxito E2E', `${e2ePassRate.toFixed(2)}%`, 
            'Porcentaje de escenarios E2E exitosos.',
            {
                breakdown: [
                    { label: 'Specs (Archivos) Totales', value: frontendMetricsData.metrics.totalSpecsExecuted.value },
                    { label: 'Specs Exitosos', value: frontendMetricsData.metrics.successSpecs.value },
                    { label: 'Specs con Fallas', value: frontendMetricsData.metrics.failedSpecs.value }
                ],
                chart: { labels: ['Exitosos', 'Fallidos'], data: [frontendMetricsData.metrics.successSpecs.value, frontendMetricsData.metrics.failedSpecs.value], colors: ['#34d399', '#f87171'] }
            }
        );

        renderMetricCard(
            'Densidad Fallas Caja Negra', blackBoxFailureDensity.toFixed(3), 
            'Fallos visuales o de flujo por cada test de interfaz.',
            {
                breakdown: [
                    { label: 'Tests Individuales Fallidos', value: frontendMetricsData.metrics.totalFailed.value },
                    { label: 'Total de Specs', value: frontendMetricsData.metrics.totalSpecsExecuted.value }
                ],
                chart: null
            }
        );
        
        // --- Nivel 4: Métricas DevOps (Suma de Tiempos) ---
        const backendLeadTime = backendMetricsData.pipeline_lead_time_seconds || 0;
        const frontendLeadTime = frontendMetricsData.metrics.pipelineLeadTimeSeconds.value || 0;
        const totalLeadTime = backendLeadTime + frontendLeadTime;

        renderMetricCard(
            'Tiempo Total de Pipelines', `${totalLeadTime}s`, 
            'Tiempo sumado de CI del Backend y Frontend.',
            {
                breakdown: [
                    { label: 'Tiempo de CI Backend', value: `${backendLeadTime}s` },
                    { label: 'Tiempo de CI Frontend', value: `${frontendLeadTime}s` },
                    { label: 'Duración Combinada', value: `${totalLeadTime}s` }
                ],
                chart: { labels: ['Backend (s)', 'Frontend (s)'], data: [backendLeadTime, frontendLeadTime], colors: ['#8b5cf6', '#ec4899'] }
            }
        );

    } catch (error) {
        console.error("Error al cargar las métricas:", error);
        metricsGrid.innerHTML = `<p class="error" style="color:var(--error-color)">Error al cargar métricas: ${error.message}</p>`;
    }
}

// Nueva función de Renderizado con soporte para Modal
function renderMetricCard(title, value, description, detailData) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
        <h3>${title}</h3>
        <p class="metric-value">${value}</p>
        <p class="metric-description">${description}</p>
    `;
    
    // Al hacer clic, enviamos los datos al Modal
    card.addEventListener('click', () => openMetricModal(title, description, detailData));
    document.getElementById('metrics-grid').appendChild(card);
}

// Función que maneja la lógica del Modal y Chart.js
function openMetricModal(title, description, detailData) {
    const modal = document.getElementById('metric-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-description').textContent = description;
    
    // 1. Construir lista de desglose
    const detailsDiv = document.getElementById('modal-details');
    let htmlList = '<h4>Desglose del cálculo:</h4><ul>';
    detailData.breakdown.forEach(item => {
        htmlList += `<li><strong>${item.label}:</strong> <span>${item.value}</span></li>`;
    });
    htmlList += '</ul>';
    detailsDiv.innerHTML = htmlList;

    // 2. Renderizar Gráfico de Torta (si aplica)
    const chartContainer = document.querySelector('.modal-chart-container');
    const ctx = document.getElementById('modal-pie-chart').getContext('2d');
    
    if (currentChart) currentChart.destroy(); // Limpiar gráfico previo

    if (detailData.chart) {
        chartContainer.style.display = 'block';
        currentChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: detailData.chart.labels,
                datasets: [{
                    data: detailData.chart.data,
                    backgroundColor: detailData.chart.colors,
                    borderColor: '#1f2937',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#f9fafb' } } }
            }
        });
    } else {
        chartContainer.style.display = 'none'; // Ocultar gráfica si es una métrica de densidad
    }

    modal.style.display = 'flex';
}

// Cerrar el modal al hacer clic en la "X" o fuera de la caja
document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('metric-modal').style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('metric-modal')) {
        document.getElementById('metric-modal').style.display = 'none';
    }
});

// ... [Mantén tu setupReportSelector y fetchFile exactamente como estaban]

async function setupReportSelector() {
    const reportSelect = document.getElementById('report-select');
    if (reportSelect.options.length > 1) return;

    const allReports = [
        { name: '[Gobernanza] Mántricas Maestras del Backend (JSON)', path: FILE_PATHS.backendMetrics },
        { name: '[Gobernanza] Mántricas Maestras del Frontend (JSON)', path: FILE_PATHS.frontendMetrics },
        { name: '[Prueba de Integración] Reporte Newman API (JSON)', path: FILE_PATHS.newmanReport },
        { name: '[Pruebas de Sistema / Aceptación] Reporte Cypress E2E Combinado (JSON)', path: FILE_PATHS.cypressReport },
        ...FILE_PATHS.surefireReports.map(path => {
            const filename = path.split('/').pop().replace('TEST-ucab.edu.ve.stocksimulator.', '').replace('TEST-', '').replace('.xml', '');
            return {
                name: `[Prueba Unitaria] Surefire XML: ${filename}`,
                path: path
            };
        })
    ];

    allReports.forEach(report => {
        const option = document.createElement('option');
        option.value = report.path;
        option.textContent = report.name;
        reportSelect.appendChild(option);
    });
}

async function fetchFile(path) {
    try {
        // En GitHub Pages o Live Server, el dashboard lee la carpeta relativa a su misma ubicación
        const response = await fetch(path); // Corregido: quitamos el prefijo '../'
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - No se encontró: ${path}`);
        }
        return await response.text();
    } catch (error) {
        console.warn(error.message);
        return null; // Devuelve null seguro para manejar el error sin romper el dashboard
    }
}

// --- PARSER 1: PRUEBAS UNITARIAS (XML) ---
function interpretSurefireXml(xmlText, container) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const testcases = xmlDoc.getElementsByTagName("testcase");
    
    // Obtener el nombre limpio de la clase de prueba para asociar su CP correspondiente
    const suiteName = xmlDoc.getElementsByTagName("testsuite")[0]?.getAttribute("name") || "";
    const classNameClean = suiteName.split('.').pop();
    const cpMeta = UNIT_TEST_DESCRIPTIONS[classNameClean] || { cp: 'N/A', sub: 'Unitaria', prio: 'Media', desc: 'Prueba de componente aislado.' };

    let html = `<div style="background-color:var(--secondary-bg); padding:1rem; border-radius:8px; margin-bottom:1rem; border-left: 5px solid var(--accent-color);">
        <h4>Trazabilidad Académica: <strong>${cpMeta.cp}</strong></h4>
        <p style="margin: 0.25rem 0; font-size:0.9rem;"><strong>Subcaracterística ISO 25010:</strong> ${cpMeta.sub} | <strong>Prioridad:</strong> ${cpMeta.prio}</p>
        <p style="margin: 0; font-size:0.9rem; color:var(--text-secondary);"><strong>Propósito de la verificación:</strong> ${cpMeta.desc}</p>
    </div>`;

    html += `<table class="report-table">
        <thead><tr><th>Método / Prueba Unitaria</th><th>Estado de Ejecución</th><th>Diagnóstico del Defecto Detectado</th></tr></thead><tbody>`;
        
    for (let tc of testcases) {
        const name = tc.getAttribute("name");
        const failure = tc.getElementsByTagName("failure")[0];
        const error = tc.getElementsByTagName("error")[0];
        
        if (failure) {
            html += `<tr><td><code>${name}</code></td><td style="color:var(--error-color); font-weight:bold;">❌ FALLÓ (Bug Documentado)</td>
                     <td><div class="trace-block"><strong>Aserción Fallida:</strong> ${failure.getAttribute("message") || 'Falla lógica'}\n${failure.textContent.trim().slice(0,250)}...</div></td></tr>`;
        } else if (error) {
            html += `<tr><td><code>${name}</code></td><td style="color:var(--warning-color); font-weight:bold;">⚠️ ERROR (Excepción)</td>
                     <td><div class="trace-block"><strong>Crash Técnico:</strong> ${error.getAttribute("message")}\n${error.textContent.trim().slice(0,250)}...</div></td></tr>`;
        } else {
            html += `<tr><td><code>${name}</code></td><td style="color:var(--success-color)">✅ PASÓ (Éxito Estático)</td><td>El componente respondió según la especificación funcional correcta.</td></tr>`;
        }
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// --- PARSER 2: PRUEBAS DE INTEGRACIÓN (NEWMAN JSON) ---
function interpretNewmanJson(jsonText, container) {
    const data = JSON.parse(jsonText);
    const executions = data.run?.executions || [];
    const failures = data.run?.failures || [];
    
    let html = `<h3>Evaluación Contractual de Endpoints (Integración API <-> Base de Datos)</h3>`;
    html += `<table class="report-table">
        <thead><tr><th>Caso / Caso de Prueba Relacionado</th><th>Endpoint Evaluado</th><th>Estado Aserción</th><th>Detalle Técnico / Logs de Integración</th></tr></thead><tbody>`;
        
    executions.forEach(ex => {
        const method = ex.request?.method || 'GET';
        const path = ex.request?.url?.path?.join('/') || 'api';
        const testName = ex.item?.name || 'Prueba de Endpoint';
        
        // Extraer el identificador CP-XX del nombre de la prueba para obtener su trazabilidad
        const idCP = testName.match(/CP-\d+/)?.[0] || 'N/A';
        const cpDesc = INTEGRATION_TEST_DESCRIPTIONS[idCP] || 'Verificación rutinaria de la firma y contratos del endpoint.';

        // Buscar si esta ejecución en concreto pertenece a la lista de fallas registradas
        const executionHasFailure = failures.find(f => f.source?.id === ex.item?.id);

        if (executionHasFailure) {
            html += `<tr style="background-color: rgba(248, 113, 113, 0.05);">
                <td><strong>${idCP}</strong></td>
                <td><strong>[${method}]</strong> /${path}<br><small style="color:var(--text-secondary);">${testName}</small></td>
                <td style="color:var(--error-color); font-weight:bold;">❌ FALLÓ</td>
                <td>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);"><strong>Falla de Contrato:</strong> ${cpDesc}</p>
                    <div class="trace-block"><strong>Aserción Fallida:</strong> ${executionHasFailure.error?.test || 'Falla de respuesta'}\n${executionHasFailure.error?.message || ''}</div>
                </td>
            </tr>`;
        } else {
            html += `<tr>
                <td><strong>${idCP}</strong></td>
                <td><strong>[${method}]</strong> /${path}<br><small style="color:var(--text-secondary);">${testName}</small></td>
                <td style="color:var(--success-color)">✅ PASÓ</td>
                <td>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);"><strong>Validación Exitosa:</strong> ${cpDesc}</p>
                    <small style="color:var(--success-color)">Status Code esperado detectado de forma segura.</small>
                </td>
            </tr>`;
        }
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// --- PARSER 3 Y 4: PRUEBAS DE SISTEMA Y ACEPTACIÓN (CYPRESS) ---
function interpretCypressJson(jsonText, container, filePath) {
    const data = JSON.parse(jsonText);
    let html = `<table class="report-table">
        <thead><tr><th>ID</th><th>Nivel Académico</th><th>Escenario de Interfaz (Cypress)</th><th>Estado</th><th>Mensaje Técnico de Falla</th></tr></thead><tbody>`;

    data.results.forEach(result => {
        const filename = result.fullFile ? result.fullFile.split('/').pop() : '';
        
        // Regla de Clasificación Académica solicitada:
        // CP-20 y CP-22 son Aceptación Flujo Completo. El resto y nuevos casos van a Sistema.
        let nivelPrueba = "Sistema (UI)";
        let idCP = filename.match(/CP-\d+/)?.[0] || "CP-General";
        
        if (filename.includes('CP-20') || filename.includes('CP-22')) {
            nivelPrueba = "Aceptación (E2E)";
        }

        result.suites.forEach(suite => {
            suite.tests.forEach(test => {
                let statusHtml = test.fail 
                    ? `<span style="color:var(--error-color)">❌ Falló</span>` 
                    : `<span style="color:var(--success-color)">✅ Pasó</span>`;
                
                let errorHtml = test.fail 
                    ? `<div class="trace-block">${test.err?.message || 'Error inesperado de aserción de caja negra.'}</div>` 
                    : 'Cumple requerimiento de subcaracterística funcional.';

                html += `<tr>
                    <td><strong>${idCP}</strong></td>
                    <td><span style="color:var(--accent-color)">${nivelPrueba}</span></td>
                    <td><strong>${suite.title}</strong><br><small class="metric-description">${test.title}</small></td>
                    <td>${statusHtml}</td>
                    <td>${errorHtml}</td>
                </tr>`;
            });
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}