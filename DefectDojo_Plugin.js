// ==UserScript==
// @name         DefectDojo Plugin
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Отправляет уязвимости в OpenProject, подсвечивает их при определенных условиях
// @author       Marauder
// @match        https://YOUR_DEFECTDOJO_DOMAIN/finding*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @homepageURL  https://github.com/ArkDrifter/summerwork2024/issues
// @updateURL    https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// @downloadURL  https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// ==/UserScript==

(function() {
    "use strict";

    // ========== CONFIGURATION ==========
    // Настройки плагина - все в одном месте для удобной настройки
    const CONFIG = {
        // DefectDojo настройки
        defectDojo: {
            domain: 'YOUR_DEFECTDOJO_DOMAIN', // Example: demo.defectdojo.org
            apiUrl: 'https://YOUR_DEFECTDOJO_DOMAIN/api/v2/', // Example: https://demo.defectdojo.org/api/v2/
            apiToken: 'YOUR_API_TOKEN', // Ключ в https://your_defectdojo_domain/api/key-v2
        },
        
        // OpenProject настройки
        openProject: {
            domain: 'YOUR_OPENPROJECT_DOMAIN', // Example: localhost:8080
            projectId: 'YOUR_PROJECT_ID', // Example: 3 или "demoDefect"
            apiUrl: 'https://YOUR_OPENPROJECT_DOMAIN/api/v3/projects/YOUR_PROJECT_ID/work_packages', // Example: https://localhost:8080/api/v3/projects/3/work_packages
            apiKey: 'your_api_key', // Ключ в https://localhost:8080/my/access_token
        },
        
        // Настройки визуализации
        ui: {
            // Режим подсветки: 'checkbox' - только чекбокс, 'row' - вся строка
            highlightMode: 'checkbox',
            // Цвета для разных статусов
            colors: {
                notAssigned: 'lightgreen', // Задача создана, но не назначена
                assigned: 'yellow',       // Задача назначена
                notExists: 'lightcoral'   // Задача не существует
            },
            // Задержка между запросами в мс
            requestDelay: 100
        },
        
        // Настройки запросов к API
        api: {
            // Максимальное количество одновременных запросов
            batchSize: 5
        }
    };

    // Создаем токены авторизации один раз
    const AUTH = {
        defectDojo: `Token ${CONFIG.defectDojo.apiToken}`,
        openProject: `Basic ${btoa(`apikey:${CONFIG.openProject.apiKey}`)}`
    };

    // ========== ДОБАВЛЯЕМ CSS СТИЛИ ==========
    GM_addStyle(`
        .dd-button {
            margin-right: 8px;
            display: inline-flex;
            align-items: center;
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .dd-button:hover {
            background-color: #45a049;
        }
        
        .dd-button:active {
            background-color: #3e8e41;
        }
        
        .dd-button svg {
            margin-right: 8px;
        }
        
        .dd-loader {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-right: 8px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .dd-tooltip {
            position: absolute;
            display: none;
            min-width: 250px;
            max-width: 500px;
            background-color: rgba(51, 51, 51, 0.95);
            color: #fff;
            text-align: left;
            border-radius: 6px;
            padding: 12px;
            z-index: 10001;
            top: -50%;
            left: 100%;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            font-size: 13px;
            line-height: 1.4;
        }
        
        .dd-tooltip-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            padding-bottom: 8px;
            margin-bottom: 8px;
        }
        
        .dd-tooltip-content {
            margin-top: 8px;
        }
        
        .dd-status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .dd-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px;
            background-color: #333;
            color: white;
            border-radius: 4px;
            z-index: 10002;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            transition: opacity 0.3s, transform 0.3s;
            opacity: 0;
            transform: translateY(-20px);
        }
        
        .dd-notification.show {
            opacity: 1;
            transform: translateY(0);
        }
        
        .dd-notification.success {
            background-color: #4CAF50;
        }
        
        .dd-notification.error {
            background-color: #f44336;
        }
        
        .dd-notification.warning {
            background-color: #ff9800;
        }
    `);

    // ========== УТИЛИТЫ ==========
    
    // Функция для отображения уведомлений
    function showNotification(message, type = 'info', duration = 3000) {
        // Удаляем предыдущие уведомления
        const existingNotifications = document.querySelectorAll('.dd-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `dd-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Показываем уведомление
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Скрываем через указанное время
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    // Функция задержки
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Функция для выполнения HTTP запросов
    function makeRequest(method, url, headers, data = null) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: headers,
                data: data ? JSON.stringify(data) : undefined,
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const result = JSON.parse(response.responseText);
                            resolve(result);
                        } catch (e) {
                            resolve(response.responseText);
                        }
                    } else {
                        reject({
                            status: response.status,
                            statusText: response.statusText,
                            response: response.responseText
                        });
                    }
                },
                onerror: error => {
                    reject(error);
                }
            });
        });
    }
    
    // Функция для пакетной обработки запросов
    async function processBatch(items, processFn, batchSize = CONFIG.api.batchSize) {
        const results = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchPromises = batch.map(item => processFn(item));
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // Небольшая задержка между партиями
                if (i + batchSize < items.length) {
                    await delay(CONFIG.ui.requestDelay);
                }
            } catch (error) {
                console.error('Error processing batch:', error);
            }
        }
        
        return results.filter(result => result !== null);
    }

    // ========== РАБОТА С OPENPROJECT ==========
    
    // Получение задач из OpenProject
    async function fetchOpenProjectTasks() {
        try {
            const data = await makeRequest('GET', CONFIG.openProject.apiUrl, {
                'Authorization': AUTH.openProject,
                'Content-Type': 'application/json'
            });
            
            return parseOpenProjectTasks(data);
        } catch (error) {
            showNotification(`Ошибка получения задач из OpenProject: ${error.statusText || 'сетевая ошибка'}`, 'error');
            console.error('Error fetching OpenProject tasks:', error);
            return [];
        }
    }
    
    // Парсинг данных задач из OpenProject
    function parseOpenProjectTasks(data) {
        return data._embedded.elements.map(task => {
            // Регулярное выражение для извлечения ID уязвимости из описания
            const findingUrlRegex = new RegExp(`https://${CONFIG.defectDojo.domain}/finding/(\\d+)`);
            const findingUrlMatch = task.description.raw.match(findingUrlRegex);
            
            return {
                id: task.id,
                subject: task.subject,
                status: task._links.status.title,
                assignee: task._links.assignee && task._links.assignee.title ? task._links.assignee.title : 'N/A',
                findingUrl: findingUrlMatch ? findingUrlMatch[0] : 'N/A',
                findingId: findingUrlMatch ? findingUrlMatch[1] : null
            };
        });
    }
    
    // Создание задачи в OpenProject
    async function createOpenProjectTask(finding) {
        const { id, title, productName, engagementName, vulnerabilityIds, cwe, severity, description } = finding;
        const findingUrl = `https://${CONFIG.defectDojo.domain}/finding/${id}`;
        
        // Формируем ссылки на уязвимости
        const vulnerabilityLinks = vulnerabilityIds && vulnerabilityIds.length > 0
            ? vulnerabilityIds.map(vul => `[${vul.vulnerability_id}](https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vul.vulnerability_id})`).join(", ")
            : "N/A";
        
        // Формируем ссылки на CWE
        const cweText = cwe ? `[CWE-${cwe}](https://cwe.mitre.org/data/definitions/${cwe}.html)` : "N/A";
        
        // Формируем ссылки на продукт и engagement
        const productLinkMarkdown = productName ? `[${productName}](${finding.productLink})` : "N/A";
        const engagementLinkMarkdown = engagementName ? `[${engagementName}](${finding.engagementLink})` : "N/A";
        
        // Формируем данные для создания задачи
        const taskData = {
            subject: title,
            description: {
                format: "markdown",
                raw: `**Finding ID/URL:** [${id}](${findingUrl})\n**CWE:** ${cweText}\n**Vulnerability IDs:** ${vulnerabilityLinks}\n**Severity:** ${severityText}\n**Product:** ${productLinkMarkdown}\n**Engagement:** ${engagementLinkMarkdown}\n\n**Description:** \n\n${description}`
            },
            project: {
                href: `/api/v3/projects/${CONFIG.openProject.projectId}`
            }
        };
        
        try {
            const response = await makeRequest('POST', CONFIG.openProject.apiUrl, {
                'Authorization': AUTH.openProject,
                'Content-Type': 'application/json'
            }, taskData);
            
            showNotification(`Задача успешно создана: ${title}`, 'success');
            return response;
        } catch (error) {
            showNotification(`Ошибка создания задачи: ${error.statusText || 'сетевая ошибка'}`, 'error');
            console.error('Error creating task:', error);
            return null;
        }
    }

    // ========== РАБОТА С DEFECTDOJO ==========
    
    // Получение данных о уязвимости из DefectDojo
    async function fetchFindingData(id) {
        try {
            const finding = await makeRequest('GET', `${CONFIG.defectDojo.apiUrl}findings/${id}/`, {
                'Authorization': AUTH.defectDojo,
                'Content-Type': 'application/json'
            });
            
            return {
                id: finding.id,
                title: finding.title,
                vulnerabilityIds: finding.vulnerability_ids,
                cwe: finding.cwe,
                severity: finding.severity,
                description: finding.description || "N/A"
            };
        } catch (error) {
            console.error(`Error fetching finding ${id}:`, error);
            return null;
        }
    }
    
    // Получение информации о продукте
    async function fetchProductData(productId) {
        try {
            const product = await makeRequest('GET', `${CONFIG.defectDojo.apiUrl}products/${productId}/`, {
                'Authorization': AUTH.defectDojo,
                'Content-Type': 'application/json'
            });
            
            return product.name;
        } catch (error) {
            console.error(`Error fetching product ${productId}:`, error);
            return 'N/A';
        }
    }
    
    // Получение информации о engagement
    async function fetchEngagementData(engagementId) {
        try {
            const engagement = await makeRequest('GET', `${CONFIG.defectDojo.apiUrl}engagements/${engagementId}/`, {
                'Authorization': AUTH.defectDojo,
                'Content-Type': 'application/json'
            });
            
            return engagement.name;
        } catch (error) {
            console.error(`Error fetching engagement ${engagementId}:`, error);
            return 'N/A';
        }
    }
    
    // ========== ОБРАБОТКА УЯЗВИМОСТЕЙ ==========
    
    // Извлечение ID уязвимости из строки таблицы
    function extractFindingId(row) {
        const findingUrl = row.querySelector("a[title]")?.getAttribute("href") || "";
        return findingUrl.split("/").pop();
    }
    
    // Извлечение ссылки на engagement
    function extractEngagementLink(row) {
        const engagementLink = row.querySelector("a[href*='/engagement/']").getAttribute("href");
        const fullEngagementLink = `https://${CONFIG.defectDojo.domain}${engagementLink}`;
        // Удаляем часть URL, начиная с '/risk_acceptance'
        return fullEngagementLink.split('/risk_acceptance')[0];
    }
    
    // Извлечение ссылки на product
    function extractProductLink(row) {
        const productLink = row.querySelector("a[href*='/product/']").getAttribute("href");
        const fullProductLink = `https://${CONFIG.defectDojo.domain}${productLink}`;
        return fullProductLink;
    }
    
    // Получение данных о выбранных уязвимостях
    function extractSelectedFindings() {
        const findingIds = [];
        document.querySelectorAll('tr.active_finding input[type="checkbox"]:checked').forEach(checkbox => {
            const row = checkbox.closest("tr");
            const findingId = extractFindingId(row);
            if (findingId) {
                findingIds.push({
                    id: findingId,
                    row: row,
                    engagementLink: extractEngagementLink(row),
                    productLink: extractProductLink(row),
                    engagementId: extractEngagementLink(row).split("/").pop(),
                    productId: extractProductLink(row).split("/").pop()
                });
            }
        });
        return findingIds;
    }
    
    // Обработка всех уязвимостей
    async function processFindings(selectedFindings) {
        // Получаем существующие задачи из OpenProject
        const openProjectTasks = await fetchOpenProjectTasks();
        
        // Показываем индикатор загрузки
        showNotification(`Обработка ${selectedFindings.length} уязвимостей...`, 'info');
        
        // Ставим индикаторы загрузки для выбранных строк
        selectedFindings.forEach(finding => {
            finding.row.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
        });
        
        // Обрабатываем уязвимости пакетами
        const processedFindings = await processBatch(selectedFindings, async (finding) => {
            // Получаем данные о уязвимости
            const findingData = await fetchFindingData(finding.id);
            if (!findingData) return null;
            
            // Добавляем данные о ссылках
            findingData.engagementLink = finding.engagementLink;
            findingData.productLink = finding.productLink;
            findingData.row = finding.row;
            
            // Получаем данные о продукте и engagement
            findingData.productName = await fetchProductData(finding.productId);
            findingData.engagementName = await fetchEngagementData(finding.engagementId);
            
            // Проверяем, существует ли задача для этой уязвимости
            const findingUrl = `https://${CONFIG.defectDojo.domain}/finding/${finding.id}`;
            const existingTask = openProjectTasks.find(task => task.findingUrl === findingUrl);
            
            if (existingTask) {
                showNotification(`Задача для ID ${finding.id} уже существует: #${existingTask.id}`, 'warning');
                finding.row.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
                return { ...findingData, existingTask };
            }
            
            // Создаем задачу в OpenProject
            const createdTask = await createOpenProjectTask(findingData);
            if (createdTask) {
                finding.row.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
                return { ...findingData, createdTask };
            } else {
                finding.row.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
                return findingData;
            }
        });
        
        // Показываем итоговое уведомление
        const created = processedFindings.filter(f => f.createdTask).length;
        const existing = processedFindings.filter(f => f.existingTask).length;
        const failed = selectedFindings.length - created - existing;
        
        showNotification(`Обработано: ${processedFindings.length}, создано: ${created}, уже существуют: ${existing}, ошибок: ${failed}`, 
                        failed > 0 ? 'warning' : 'success', 
                        5000);
        
        return processedFindings;
    }
    
    // ========== ВИЗУАЛИЗАЦИЯ ==========
    
    // Добавление кнопки отправки
    function addSendButton() {
        const btnGroup = document.querySelector(".dt-buttons.btn-group");
        if (!btnGroup) return;
        
        const button = document.createElement("button");
        button.className = "dd-button";
        button.type = "button";
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Отправить в OpenProject
        `;
        button.onclick = handleSendButtonClick;
        btnGroup.appendChild(button);
    }
    
    // Обработка клика по кнопке отправки
    async function handleSendButtonClick() {
        const selectedFindings = extractSelectedFindings();
        
        if (selectedFindings.length === 0) {
            showNotification("Выберите хотя бы одну уязвимость", "warning");
            return;
        }
        
        // Меняем текст кнопки на индикатор загрузки
        const button = event.currentTarget;
        const originalContent = button.innerHTML;
        button.innerHTML = `<div class="dd-loader"></div> Обработка...`;
        button.disabled = true;
        
        try {
            await processFindings(selectedFindings);
        } catch (error) {
            console.error("Error processing findings:", error);
            showNotification("Ошибка при обработке уязвимостей", "error");
        } finally {
            // Восстанавливаем кнопку
            button.innerHTML = originalContent;
            button.disabled = false;
            
            // Обновляем визуализацию статусов
            await updateVisualization();
        }
    }
    
    // Создание тултипов для уязвимостей
    async function createTooltips(openProjectTasks) {
        // Выбираем все строки с уязвимостями
        const rows = document.querySelectorAll('tr.active_finding');
        
        rows.forEach(row => {
            // Находим ID уязвимости
            const findingLink = row.querySelector('a[href*="/finding/"]');
            if (!findingLink) return;
            
            const findingId = findingLink.href.split('/').pop();
            const task = openProjectTasks.find(task => task.findingId === findingId);
            
            // Настраиваем стиль строки в зависимости от режима подсветки
            if (CONFIG.ui.highlightMode === 'row') {
                if (task) {
                    row.style.backgroundColor = task.assignee === 'N/A' ? CONFIG.ui.colors.notAssigned : CONFIG.ui.colors.assigned;
                } else {
                    row.style.backgroundColor = CONFIG.ui.colors.notExists;
                }
            } else {
                // Подсветка только ячейки с чекбоксом
                const checkboxCell = row.querySelector('.noVis:first-child');
                if (checkboxCell) {
                    if (task) {
                        checkboxCell.style.backgroundColor = task.assignee === 'N/A' ? CONFIG.ui.colors.notAssigned : CONFIG.ui.colors.assigned;
                    } else {
                        checkboxCell.style.backgroundColor = CONFIG.ui.colors.notExists;
                    }
                }
            }
            
            // Создаем тултип
            const tooltip = document.createElement('div');
            tooltip.className = 'dd-tooltip';
            
            if (task) {
                const statusColor = task.assignee === 'N/A' ? '#4CAF50' : '#FFC107';
                
                tooltip.innerHTML = `
                    <div class="dd-tooltip-header">
                        <strong>OpenProject #${task.id}</strong>
                        <span class="dd-status-badge" style="background-color: ${statusColor}">
                            ${task.status}
                        </span>
                    </div>
                    <div class="dd-tooltip-content">
                        <div><strong>Тема:</strong> ${task.subject}</div>
                        <div><strong>Исполнитель:</strong> ${task.assignee}</div>
                        <div>
                            <a href="https://${CONFIG.openProject.domain}/projects/${CONFIG.openProject.projectId}/work_packages/${task.id}" 
                               target="_blank" style="color: #3fa5cc; text-decoration: none;">
                                Открыть задачу →
                            </a>
                        </div>
                    </div>
                `;
            } else {
                tooltip.innerHTML = `
                    <div class="dd-tooltip-header">
                        <strong>Нет в OpenProject</strong>
                    </div>
                    <div class="dd-tooltip-content">
                        <div>Уязвимость не отправлена в OpenProject</div>
                    </div>
                `;
            }
            
            // Добавляем тултип и события для его показа/скрытия
            row.style.position = 'relative';
            row.appendChild(tooltip);
            
            row.addEventListener('mouseover', () => {
                tooltip.style.display = 'block';
            });
            
            row.addEventListener('mouseout', () => {
                tooltip.style.display = 'none';
            });
        });
    }
    
    // Обновление визуализации статусов
    async function updateVisualization() {
        try {
            const openProjectTasks = await fetchOpenProjectTasks();
            createTooltips(openProjectTasks);
        } catch (error) {
            console.error('Error updating visualization:', error);
            showNotification('Ошибка при обновлении статусов', 'error');
        }
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    
    // Основная функция
    async function initialize() {
        try {
            // Добавляем кнопку отправки
            addSendButton();
            
            // Инициализируем визуализацию статусов
            await updateVisualization();
            
            console.log('DefectDojo Plugin initialized successfully');
        } catch (error) {
            console.error('Error initializing plugin:', error);
            showNotification('Ошибка при инициализации плагина', 'error');
        }
    }
    
    // Запускаем инициализацию после загрузки страницы
    window.addEventListener('load', initialize);
})();