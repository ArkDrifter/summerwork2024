// ==UserScript==
// @name         Send to OpenProject Button
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Добавляет кнопку "Send to OpenProject" в DefectDojo и подсвечивает уязвимости
// @author       Your Name
// @match        https://demo.defectdojo.org/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// ==/UserScript==

(function ($) {
    "use strict";

    // OpenProject API настройки
    const openprojectUrl = "http://localhost:8088/api/v3/projects/3/work_packages";
    const openprojectAuth = "Basic ";

    // DefectDojo API настройки
    const defectDojoUrl = 'https://demo.defectdojo.org/api/v2/';
    const defectDojoToken = 'Token ';

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
        const fullEngagementLink = `https://demo.defectdojo.org${engagementLink}`;
        // Удаляем часть URL, начиная с '/risk_acceptance'
        return fullEngagementLink.split('/risk_acceptance')[0];
    }

    // Функция для извлечения ссылки на product
    function extractProductLink(row) {
        const productLink = row.querySelector("a[href*='/product/']").getAttribute("href");
        const fullProductLink = `https://demo.defectdojo.org${productLink}`;
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

    // Функция для получения данных из DefectDojo API о найденных уязвимостях
    function fetchFindingsData(findingIds, callback) {
        const findings = [];
        let requestsCompleted = 0;

        findingIds.forEach(id => {
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
        });
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
        const findingUrl = `https://demo.defectdojo.org/finding/${id}`;

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
                href: "/api/v3/projects/3"
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


    // Функция для подсветки уязвимостей
    function highlightFindings() {
        const rows = document.querySelectorAll('tbody tr');
        fetchOpenProjectTasks(openprojectTasks => {
            rows.forEach(row => {
                const findingId = extractFindingId(row);
                const findingUrl = `https://demo.defectdojo.org/finding/${findingId}`;
                const taskExists = openprojectTasks.some(task => task.description.raw.includes(findingUrl));
                if (taskExists) {
                    row.style.backgroundColor = "lightgreen";
                } else {
                   row.style.backgroundColor = "lightcoral";
                }
            });
        });
    }

    // Запускаем функции после загрузки страницы
    window.onload = () => {
        addButton();
        highlightFindings();
    };

})(jQuery);
