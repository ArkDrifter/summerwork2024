// ==UserScript==
// @name         DefectDojo Plugin
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Отправляет уязвимости в OpenProject, подсвечивает их при определенных условиях
// @author       Marauder
// @match        https://your_defectdojo_domain/finding*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// ==/UserScript==

(function ($) {
    "use strict";

    // OpenProject API настройки
    const openprojectUrl = "https://your_openproject_domain/api/v3/projects/{project_id}/work_packages";
    const apiKeyOP = "your_api_key";
    const creatingApiToken = btoa(`apikey:${apiKeyOP}`);    //Ключ кодируется в base64
    const openprojectAuth = `Basic ${creatingApiToken}`;  

    // DefectDojo API настройки
    const defectDojoUrl = 'https://your_defectdojo_domain/api/v2/';
    const defectDojoToken = 'Token d283e5f2fb2945730149d0fbdf2b896a91b4d445'; 

    // Функция для добавления кнопки
    function addButton() {
        const btnGroup = document.querySelector(".dt-buttons.btn-group");
        if (btnGroup) {
            const button = document.createElement("button");
            button.className = "btn btn-default";
            button.type = "button";
            button.innerHTML = "<span>Send to OpenProject</span>";
            button.onclick = handleButtonClick;
            btnGroup.appendChild(button);
        }
    }

    // Функция для обработки клика по кнопке
    function handleButtonClick() {
        const findingIds = extractSelectedFindings();
        if (findingIds.length === 0) {
            alert("Please select at least one finding.");
            return;
        }
        console.log("Selected Findings:", findingIds); // Логируем массив выбранных уязвимостей
        fetchOpenProjectTasks(openprojectTasks => {
            fetchFindingsData(findingIds.map(finding => finding.id), findings => {
                findings.forEach((finding, index) => {
                    finding.engagementLink = findingIds[index].engagementLink;
                    finding.productLink = findingIds[index].productLink;
                    getProductAndEngagementNames(finding, productAndEngagementNames => {
                        finding.productName = productAndEngagementNames.productName;
                        finding.engagementName = productAndEngagementNames.engagementName;
                        createOpenProjectTaskIfNotExists(finding, openprojectTasks);
                    });
                });
                console.log("Findings Data:", findings); // Логируем массив данных всех уязвимостей
                alert(`Processed ${findings.length} findings for OpenProject`);
            });
        });
    }

    // Функция для извлечения ID уязвимостей
    function extractFindingId(row) {
        const findingUrl = row.querySelector("a[title]")?.getAttribute("href") || "";
        return findingUrl.split("/").pop();
    }

    // Функция для извлечения ссылки на engagement
    function extractEngagementLink(row) {
        const engagementLink = row.querySelector("a[href*='/engagement/']").getAttribute("href");
        const fullEngagementLink = `https://your_defectdojo_domain${engagementLink}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Перед $ / не ставить  
        // Удаляем часть URL, начиная с '/risk_acceptance'
        return fullEngagementLink.split('/risk_acceptance')[0];
    }

    // Функция для извлечения ссылки на product
    function extractProductLink(row) {
        const productLink = row.querySelector("a[href*='/product/']").getAttribute("href");
        const fullProductLink = `https://your_defectdojo_domain${productLink}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ.Перед $ / не ставить
        return fullProductLink;
    }

    // Функция для получения данных о выбранных уязвимостях
    function extractSelectedFindings() {
        const findingIds = [];
        document.querySelectorAll('tr.active_finding input[type="checkbox"]:checked').forEach(checkbox => {
            const row = checkbox.closest("tr");
            const findingId = extractFindingId(row);
            if (findingId) {
                findingIds.push({
                    id: findingId,
                    engagementLink: extractEngagementLink(row),
                    productLink: extractProductLink(row)
                });
            }
        });
        return findingIds;
    }

    // Функция для получения данных OpenProject с помощью GM_xmlhttpRequest
    function fetchOpenProjectData(urlOpenProject, apiKey) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: urlOpenProject,
                headers: {
                    'Authorization': apiKey
                },
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(response.statusText);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Запрос данных OpenProject 
    function parseOpenProjectData(data) {
        return data._embedded.elements.map(task => {
            const findingUrlMatch = task.description.raw.match(/https:\/\/your_defectdojo_domain\/finding\/(\d+)/); //ЗАМЕНИТЬ ИНФОРМАЦИЮ.
            return {
                id: task.id,
                status: task._links.status.title,
                assignee: task._links.assignee && task._links.assignee.title ? task._links.assignee.title : 'N/A',
                findingUrl: findingUrlMatch ? findingUrlMatch[0] : 'N/A'
            };
        });
    }

    // Функция задержки
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Функция для получения данных из DefectDojo API о найденных уязвимостях
    async function fetchFindingsData(findingIds, callback) {
        const findings = [];
        const delayMs = 100; // Задержка между запросами
        let requestsCompleted = 0;

        for (const id of findingIds) {
            await delay(delayMs); // Задержка перед следующим запросом
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${defectDojoUrl}findings/${id}/`,
                headers: {
                    'Authorization': defectDojoToken,
                    'Content-Type': 'application/json'
                },
                onload: response => {
                    if (response.status === 200) {
                        const finding = JSON.parse(response.responseText);
                        findings.push({
                            id: finding.id,
                            title: finding.title,
                            vulnerabilityIds: finding.vulnerability_ids,
                            cwe: finding.cwe,
                            severity: finding.severity,
                            description: finding.description || "N/A"
                        });
                    } else {
                        console.error(`Failed to fetch finding ${id}: ${response.status} - ${response.statusText}`);
                    }
                    requestsCompleted++;
                    if (requestsCompleted === findingIds.length) {
                        callback(findings);
                    }
                },
                onerror: error => {
                    console.error(`Error fetching finding ${id}:`, error);
                    requestsCompleted++;
                    if (requestsCompleted === findingIds.length) {
                        callback(findings);
                    }
                }
            });
        }
    }


    // Функция для получения имен продукта и engagement
    function getProductAndEngagementNames(finding, callback) {
        let productName = "N/A";
        let engagementName = "N/A";

        const fetchProductName = new Promise((resolve, reject) => {
            if (finding.productLink) {
                const productId = finding.productLink.split("/").pop();
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${defectDojoUrl}products/${productId}/`,
                    headers: {
                        'Authorization': defectDojoToken,
                        'Content-Type': 'application/json'
                    },
                    onload: response => {
                        if (response.status === 200) {
                            const product = JSON.parse(response.responseText);
                            productName = product.name;
                        } else {
                            console.error(`Failed to fetch product ${productId}: ${response.status} - ${response.statusText}`);
                        }
                        resolve();
                    },
                    onerror: error => {
                        console.error(`Error fetching product ${productId}:`, error);
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });

        const fetchEngagementName = new Promise((resolve, reject) => {
            if (finding.engagementLink) {
                const engagementId = finding.engagementLink.split("/").pop();
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${defectDojoUrl}engagements/${engagementId}/`,
                    headers: {
                        'Authorization': defectDojoToken,
                        'Content-Type': 'application/json'
                    },
                    onload: response => {
                        if (response.status === 200) {
                            const engagement = JSON.parse(response.responseText);
                            engagementName = engagement.name;
                        } else {
                            console.error(`Failed to fetch engagement ${engagementId}: ${response.status} - ${response.statusText}`);
                        }
                        resolve();
                    },
                    onerror: error => {
                        console.error(`Error fetching engagement ${engagementId}:`, error);
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });

        Promise.all([fetchProductName, fetchEngagementName]).then(() => {
            callback({
                productName: productName,
                engagementName: engagementName
            });
        });
    }

    // Функция для получения задач из OpenProject
    function fetchOpenProjectTasks(callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: openprojectUrl,
            headers: {
                'Authorization': openprojectAuth,
                'Content-Type': 'application/json'
            },
            onload: response => {
                if (response.status === 200) {
                    const data = JSON.parse(response.responseText);
                    const tasks = data._embedded.elements;
                    callback(tasks);
                } else {
                    console.error(`Failed to fetch OpenProject tasks: ${response.status} - ${response.statusText}`);
                    callback([]);
                }
            },
            onerror: error => {
                console.error("Error fetching OpenProject tasks:", error);
                callback([]);
            }
        });
    }

        // Функция для создания задачи в OpenProject, если она не существует
    function createOpenProjectTaskIfNotExists(finding, openprojectTasks) {
        const { id, engagementLink, productLink, productName, engagementName, vulnerabilityIds, cwe, severity, description } = finding;
        const findingUrl = `https://your_defectdojo_domain/finding/${id}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ.

        // Проверяем, существует ли уже задача в OpenProject
        const taskExists = openprojectTasks.some(task => task.description.raw.includes(findingUrl));
        if (taskExists) {
            alert(`Task for finding ID ${id} already exists in OpenProject. Skipping creation.`);
            return;
        }

        // Формируем ссылки на уязвимости, или выводим "N/A", если нет уязвимостей
        const vulnerabilityLinks = vulnerabilityIds && vulnerabilityIds.length > 0
            ? vulnerabilityIds.map(vul => `[${vul.vulnerability_id}](https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vul.vulnerability_id})`).join(", ")
            : "N/A";

        // Проверяем наличие значений CWE и Severity, иначе выводим "N/A"
        const cweText = cwe ? `[CWE-${cwe}](https://cwe.mitre.org/data/definitions/${cwe}.html)` : "N/A";
        const severityText = severity || "N/A";

        // Формируем ссылки на продукт и engagement
        const productLinkMarkdown = productName ? `[${productName}](${productLink})` : "N/A";
        const engagementLinkMarkdown = engagementName ? `[${engagementName}](${engagementLink})` : "N/A";

        // Отправляем данные в OpenProject
        const taskData = {
            subject: finding.title,
            description: {
                format: "markdown",
                raw: `**Finding ID/URL:** [${id}](${findingUrl})\n**CWE:** ${cweText}\n**Vulnerability IDs:** ${vulnerabilityLinks}\n**Severity:** ${severityText}\n**Product Link:** ${productLinkMarkdown}\n**Engagement Link:** ${engagementLinkMarkdown}\n\n**Description:** \n\n ${description}`
            },
            project: {
                href: "/api/v3/projects/your_project_id" //ЗАМЕНИТЬ ИНФОРМАЦИЮ.
            }
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: openprojectUrl,
            headers: {
                Authorization: openprojectAuth,
                "Content-Type": "application/json"
            },
            data: JSON.stringify(taskData),
            onload: response => {
                if (response.status === 200 || response.status === 201) {
                    console.log(`Task created for finding: ${finding.title}`);
                } else {
                    console.error(`Failed to create task: ${response.status} - ${response.statusText}`);
                    console.error(response.responseText); // Выводим текст ошибки для отладки
                }
            },
            onerror: error => {
                console.error("Error creating task:", error);
            }
        });
    }

    // Функция создания и добавления тултипа в поле чекбокса
    function createTooltips(data) {
        // Выбираем все чекбоксы уязвимостей
        const checkboxes = document.querySelectorAll('.active_finding .noVis:first-child form input');

        checkboxes.forEach(checkbox => {
            if (checkbox.parentElement && checkbox.parentElement.parentElement) {
                checkbox.parentElement.parentElement.style.position = 'relative';

                const tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.style.position = 'absolute';
                tooltip.style.display = 'none';
                tooltip.style.minWidth = '250px';  
                tooltip.style.maxWidth = '1000px';  
                tooltip.style.backgroundColor = 'rgba(51, 51, 51, 0.85)'; 
                tooltip.style.color = '#fff';
                tooltip.style.textAlign = 'left';   
                tooltip.style.borderRadius = '6px';
                tooltip.style.padding = '10px';
                tooltip.style.zIndex = '10001';
                tooltip.style.top = '-50%';
                tooltip.style.left = '100%';
                tooltip.style.whiteSpace = 'normal';  
                tooltip.style.wordWrap = 'break-word'; 

                // Ищем задачу, соответствующую уязвимости
                const task = data.find(task => task.findingUrl.includes(`/finding/${checkbox.id}`));

                if (task) {
                    const link = document.createElement('a');
                    link.href = `https://your_openproject_domain/projects/your_project_id/work_packages/${task.id}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ.
                    link.target = '_blank';
                    link.innerText = `${task.id}`;
                    link.style.color = '#3fa5cc';  

                    tooltip.innerHTML = `ID: `;
                    tooltip.appendChild(link);
                    tooltip.innerHTML += `;<br>Status: ${task.status};<br>Assignee: ${task.assignee};`;

                    // Подсветка полей чекбокса. Если существует - зеленое, если есть исполнитель - желтое, если нет - красное.
                    if (task.assignee === 'N/A') {
                        checkbox.parentElement.parentElement.style.backgroundColor = 'lightgreen';
                    } else {
                        checkbox.parentElement.parentElement.style.backgroundColor = 'yellow';
                    }
                } else {
                    tooltip.innerHTML = "ID: N/A;<br>Status: N/A;<br>Assignee: N/A;";
                    checkbox.parentElement.parentElement.style.backgroundColor = 'lightcoral';
                }

                checkbox.parentElement.parentElement.appendChild(tooltip);

                // Добавляем события для показа и скрытия тултипа
                checkbox.parentElement.parentElement.addEventListener('mouseover', () => {
                    tooltip.style.display = 'block';
                });

                checkbox.parentElement.parentElement.addEventListener('mouseout', () => {
                    tooltip.style.display = 'none';
                });

                console.log('Tooltip created for checkbox with ID:', checkbox.id);
            }
        });
    }

    // Main функция для запроса данных и добавления тултипа
    async function main() {
        try {
            const openProjectData = await fetchOpenProjectData(openprojectUrl, openprojectAuth);
            const parsedOpenProjectData = parseOpenProjectData(openProjectData);
            console.log('Parsed OpenProject Data:', parsedOpenProjectData);

            createTooltips(parsedOpenProjectData);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        addButton();
    }

    // Запуск main функции
    window.addEventListener('load', main);

})(jQuery);
