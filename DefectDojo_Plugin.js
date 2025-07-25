// ==UserScript==
// @name         DefectDojo Plugin
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Отправляет уязвимости в OpenProject, подсвечивает их при определенных условиях
// @author       Marauder
// @match        https://demo.defectdojo.org/finding*
// @grant        GM_xmlhttpRequest
// @homepageURL  https://github.com/ArkDrifter/summerwork2024/issues
// @updateURL    https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// @downloadURL  https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// ==/UserScript==

(function () {
  "use strict";

  // =========================
  // КОНФИГУРАЦИЯ
  // =========================
  // Меняйте только значения в этом объекте
  const config = {
    // OpenProject
    openproject: {
      url: "http://192.101.101.68:8085", // Базовый URL OpenProject
      apiKey:
        "df5f67456dbcd3de70c7b541c9b7c0ffc09778cd8e3822c5124b9e2e025079f3", // Ключ пользователя
      workPackagesPath: "/api/v3/projects/testproj/work_packages", // Путь для создания задач (work_packages)
      projectsPath: "/api/v3/projects", // Путь для получения списка проектов
    },
    // DefectDojo
    defectdojo: {
      url: "https://demo.defectdojo.org", // Базовый URL DefectDojo
      apiPath: "/api/v2/", // Путь к API
      token: "Token 548afd6fab3bea9794a41b31da0e9404f733e222", // API-токен пользователя
    },
  };

  // =========================
  // 1. Переменные на основе конфигурации
  // =========================
  // OpenProject
  const openprojectUrl =
    config.openproject.url + config.openproject.workPackagesPath;
  const creatingApiToken = btoa(`apikey:${config.openproject.apiKey}`); // Ключ кодируется в base64
  const openprojectAuth = `Basic ${creatingApiToken}`;
  const openprojectProjectsUrl =
    config.openproject.url + config.openproject.projectsPath;

  // DefectDojo
  const defectDojoUrl = config.defectdojo.url + config.defectdojo.apiPath;
  const defectDojoToken = config.defectdojo.token;

  // =========================
  // 2. Вспомогательные функции
  // =========================
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =========================
  // 3. Работа с DefectDojo
  // =========================
  async function fetchFindingsData(findingIds, callback) {
    const findings = [];
    const delayMs = 100;
    let requestsCompleted = 0;

    for (const id of findingIds) {
      await delay(delayMs);
      GM_xmlhttpRequest({
        method: "GET",
        url: `${defectDojoUrl}findings/${id}/`,
        headers: {
          Authorization: defectDojoToken,
          "Content-Type": "application/json",
        },
        onload: (response) => {
          if (response.status === 200) {
            const finding = JSON.parse(response.responseText);
            findings.push({
              id: finding.id,
              title: finding.title,
              vulnerabilityIds: finding.vulnerability_ids,
              cwe: finding.cwe,
              severity: finding.severity,
              description: finding.description || "N/A",
            });
          } else {
            console.error(
              `Failed to fetch finding ${id}: ${response.status} - ${response.statusText}`
            );
          }
          requestsCompleted++;
          if (requestsCompleted === findingIds.length) {
            callback(findings);
          }
        },
        onerror: (error) => {
          console.error(`Error fetching finding ${id}:`, error);
          requestsCompleted++;
          if (requestsCompleted === findingIds.length) {
            callback(findings);
          }
        },
      });
    }
  }

  function getProductAndEngagementNames(finding, callback) {
    let productName = "N/A";
    let engagementName = "N/A";

    const fetchProductName = new Promise((resolve) => {
      if (finding.productLink) {
        const productId = finding.productLink.split("/").pop();
        GM_xmlhttpRequest({
          method: "GET",
          url: `${defectDojoUrl}products/${productId}/`,
          headers: {
            Authorization: defectDojoToken,
            "Content-Type": "application/json",
          },
          onload: (response) => {
            if (response.status === 200) {
              const product = JSON.parse(response.responseText);
              productName = product.name;
            } else {
              console.error(
                `Failed to fetch product ${productId}: ${response.status} - ${response.statusText}`
              );
            }
            resolve();
          },
          onerror: (error) => {
            console.error(`Error fetching product ${productId}:`, error);
            resolve();
          },
        });
      } else {
        resolve();
      }
    });

    const fetchEngagementName = new Promise((resolve) => {
      if (finding.engagementLink) {
        const engagementId = finding.engagementLink.split("/").pop();
        GM_xmlhttpRequest({
          method: "GET",
          url: `${defectDojoUrl}engagements/${engagementId}/`,
          headers: {
            Authorization: defectDojoToken,
            "Content-Type": "application/json",
          },
          onload: (response) => {
            if (response.status === 200) {
              const engagement = JSON.parse(response.responseText);
              engagementName = engagement.name;
            } else {
              console.error(
                `Failed to fetch engagement ${engagementId}: ${response.status} - ${response.statusText}`
              );
            }
            resolve();
          },
          onerror: (error) => {
            console.error(`Error fetching engagement ${engagementId}:`, error);
            resolve();
          },
        });
      } else {
        resolve();
      }
    });

    Promise.all([fetchProductName, fetchEngagementName]).then(() => {
      callback({
        productName: productName,
        engagementName: engagementName,
      });
    });
  }

  // =========================
  // 4. Работа с OpenProject
  // =========================
  function fetchOpenProjectData(urlOpenProject, apiKey) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: urlOpenProject,
        headers: {
          Authorization: apiKey,
        },
        onload: function (response) {
          if (response.status >= 200 && response.status < 300) {
            resolve(JSON.parse(response.responseText));
          } else {
            reject(response.statusText);
          }
        },
        onerror: function (error) {
          reject(error);
        },
      });
    });
  }

  // Получить список проектов OpenProject
  function fetchOpenProjectProjects(callback) {
    GM_xmlhttpRequest({
      method: "GET",
      url: openprojectProjectsUrl, //ЗАМЕНИТЬ ИНФОРМАЦИЮ
      headers: {
        Authorization: openprojectAuth,
        "Content-Type": "application/json",
      },
      onload: (response) => {
        if (response.status === 200) {
          const data = JSON.parse(response.responseText);
          callback(data._embedded.elements);
        } else {
          alert("Ошибка при получении списка проектов OpenProject");
          callback([]);
        }
      },
      onerror: () => {
        alert("Ошибка при получении списка проектов OpenProject");
        callback([]);
      },
    });
  }

  function parseOpenProjectData(data) {
    return data._embedded.elements.map((task) => {
      const findingUrlMatch = task.description.raw.match(
        /https:\/\/demo.defectdojo.org\/finding\/(\d+)/
      );
      return {
        id: task.id,
        status: task._links.status.title,
        assignee:
          task._links.assignee && task._links.assignee.title
            ? task._links.assignee.title
            : "N/A",
        findingUrl: findingUrlMatch ? findingUrlMatch[0] : "N/A",
      };
    });
  }

  function fetchOpenProjectTasks(callback) {
    GM_xmlhttpRequest({
      method: "GET",
      url: openprojectUrl,
      headers: {
        Authorization: openprojectAuth,
        "Content-Type": "application/json",
      },
      onload: (response) => {
        if (response.status === 200) {
          const data = JSON.parse(response.responseText);
          const tasks = data._embedded.elements;
          callback(tasks);
        } else {
          console.error(
            `Failed to fetch OpenProject tasks: ${response.status} - ${response.statusText}`
          );
          callback([]);
        }
      },
      onerror: (error) => {
        console.error("Error fetching OpenProject tasks:", error);
        callback([]);
      },
    });
  }

  // Модальное окно выбора проектов (чекбоксы)
  function showProjectSelectModal(projects, onSelect) {
    // Удалить старое модальное окно, если оно есть
    const oldModal = document.getElementById("op-project-modal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.id = "op-project-modal";
    modal.className = "op-modal";

    const box = document.createElement("div");
    box.className = "op-modal-box";

    const label = document.createElement("label");
    label.textContent = "Выберите проекты для отправки задач:";
    label.className = "op-modal-label";

    // Список чекбоксов
    const form = document.createElement("form");
    form.className = "op-modal-form";
    projects.forEach((project) => {
      const lbl = document.createElement("label");
      lbl.style.display = "block";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = project._links.self.href;
      lbl.appendChild(checkbox);
      lbl.appendChild(document.createTextNode(" " + project.name));
      form.appendChild(lbl);
    });

    const okBtn = document.createElement("button");
    okBtn.textContent = "Отправить";
    okBtn.className = "op-btn op-btn-primary";
    okBtn.style.marginRight = "12px";
    okBtn.onclick = (e) => {
      e.preventDefault();
      const checked = Array.from(
        form.querySelectorAll("input[type=checkbox]:checked")
      ).map((cb) => cb.value);
      if (checked.length === 0) {
        alert("Выберите хотя бы один проект!");
        return;
      }
      onSelect(checked);
      modal.remove();
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Отмена";
    cancelBtn.className = "op-btn";
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      modal.remove();
    };

    box.appendChild(label);
    box.appendChild(form);
    box.appendChild(okBtn);
    box.appendChild(cancelBtn);
    modal.appendChild(box);
    document.body.appendChild(modal);
  }

  // Глобальная переменная для хранения выбранных проектов
  let selectedProjectHrefs = [];

  function handleButtonClick() {
    const findingIds = extractSelectedFindings();
    if (findingIds.length === 0) {
      showNotification("Выберите хотя бы одну уязвимость", "warning");
      return;
    }
    // Получаем проекты и показываем выбор
    fetchOpenProjectProjects((projects) => {
      if (!projects.length) {
        showNotification("Нет доступных проектов в OpenProject", "error");
        return;
      }
      showProjectSelectModal(projects, (projectHrefs) => {
        selectedProjectHrefs = projectHrefs;
        fetchOpenProjectTasks((openprojectTasks) => {
          processFindings(findingIds, openprojectTasks);
        });
      });
    });
  }

  function processFindings(findingIds, openprojectTasks) {
    showNotification(`Обработка ${findingIds.length} уязвимостей...`, "info");
    fetchFindingsData(
      findingIds.map((finding) => finding.id),
      (findings) => {
        findings.forEach((finding, index) => {
          finding.engagementLink = findingIds[index].engagementLink;
          finding.productLink = findingIds[index].productLink;
          processFinding(finding, openprojectTasks);
        });
        showNotification(
          `Обработано: ${findings.length} уязвимостей`,
          "success"
        );
        console.log("Findings Data:", findings);
      }
    );
  }

  function processFinding(finding, openprojectTasks) {
    getProductAndEngagementNames(finding, (productAndEngagementNames) => {
      finding.productName = productAndEngagementNames.productName;
      finding.engagementName = productAndEngagementNames.engagementName;
      createOpenProjectTaskIfNotExists(finding, openprojectTasks);
    });
  }

  // Функция для создания задачи в OpenProject, если она не существует
  function createOpenProjectTaskIfNotExists(finding, openprojectTasks) {
    const {
      id,
      engagementLink,
      productLink,
      productName,
      engagementName,
      vulnerabilityIds,
      cwe,
      severity,
      description,
    } = finding;
    const findingUrl = `https://demo.defectdojo.org/finding/${id}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: https://demo.defectdojo.org/finding/

    // Проверяем, существует ли уже задача в OpenProject
    const taskExists = openprojectTasks.some((task) =>
      task.description.raw.includes(findingUrl)
    );
    if (taskExists) {
      showNotification(
        `Task for finding ID ${id} already exists in OpenProject. Skipping creation.`,
        "warning"
      );
      return;
    }

    // Формируем ссылки на уязвимости, или выводим "N/A", если нет уязвимостей
    const vulnerabilityLinks =
      vulnerabilityIds && vulnerabilityIds.length > 0
        ? vulnerabilityIds
            .map(
              (vul) =>
                `[${vul.vulnerability_id}](https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vul.vulnerability_id})`
            )
            .join(", ")
        : "N/A";

    // Проверяем наличие значений CWE и Severity, иначе выводим "N/A"
    const cweText = cwe
      ? `[CWE-${cwe}](https://cwe.mitre.org/data/definitions/${cwe}.html)`
      : "N/A";
    const severityText = severity || "N/A";

    // Формируем ссылки на продукт и engagement
    const productLinkMarkdown = productName
      ? `[${productName}](${productLink})`
      : "N/A";
    const engagementLinkMarkdown = engagementName
      ? `[${engagementName}](${engagementLink})`
      : "N/A";

    // Отправляем данные в OpenProject для каждого выбранного проекта
    selectedProjectHrefs.forEach((projectHref) => {
      const taskData = {
        subject: finding.title,
        description: {
          format: "markdown",
          raw: `**Finding ID/URL:** [${id}](${findingUrl})\n**CWE:** ${cweText}\n**Vulnerability IDs:** ${vulnerabilityLinks}\n**Severity:** ${severityText}\n**Product Link:** ${productLinkMarkdown}\n**Engagement Link:** ${engagementLinkMarkdown}\n\n**Description:** \n\n ${description}`,
        },
        project: {
          href: projectHref,
        },
      };

      GM_xmlhttpRequest({
        method: "POST",
        url: openprojectUrl,
        headers: {
          Authorization: openprojectAuth,
          "Content-Type": "application/json",
        },
        data: JSON.stringify(taskData),
        onload: (response) => {
          if (response.status === 200 || response.status === 201) {
            showNotification(
              `Task created for finding: ${finding.title}`,
              "success"
            );
            console.log(
              `Task created for finding: ${finding.title} в проекте ${projectHref}`
            );
          } else {
            showNotification(
              `Failed to create task: ${response.status} - ${response.statusText}`,
              "error"
            );
            console.error(
              `Failed to create task: ${response.status} - ${response.statusText}`
            );
            console.error(response.responseText);
          }
        },
        onerror: (error) => {
          showNotification("Error creating task", "error");
          console.error("Error creating task:", error);
        },
      });
    });
  }

  // =========================
  // 5. UI: Кнопки, тултипы, подсветка
  // =========================
  function addButton() {
    const btnGroup = document.querySelector(".dt-buttons.btn-group");
    if (btnGroup) {
      const button = document.createElement("button");
      button.className = "btn btn-default";
      button.type = "button";
      button.innerHTML = "<span>Send to OpenProject</span>";
      button.addEventListener("click", handleButtonClick);
      btnGroup.appendChild(button);
    }
  }

  function extractFindingId(row) {
    const findingUrl =
      row.querySelector("a[title]")?.getAttribute("href") || "";
    return findingUrl.split("/").pop();
  }

  function extractEngagementLink(row) {
    const engagementLink = row
      .querySelector("a[href*='/engagement/']")
      .getAttribute("href");
    const fullEngagementLink = `https://demo.defectdojo.org${engagementLink}`;
    return fullEngagementLink.split("/risk_acceptance")[0];
  }

  function extractProductLink(row) {
    const productLink = row
      .querySelector("a[href*='/product/']")
      .getAttribute("href");
    const fullProductLink = `https://demo.defectdojo.org${productLink}`;
    return fullProductLink;
  }

  function extractSelectedFindings() {
    const findingIds = [];
    document
      .querySelectorAll('input[type="checkbox"].select_one:checked')
      .forEach((checkbox) => {
        const row = checkbox.closest("tr");
        const findingId = extractFindingId(row);
        if (findingId) {
          findingIds.push({
            id: findingId,
            engagementLink: extractEngagementLink(row),
            productLink: extractProductLink(row),
          });
        }
      });
    return findingIds;
  }

  function createTooltips(data) {
    const checkboxes = document.querySelectorAll(
      'input[type="checkbox"].select_one'
    );
    checkboxes.forEach((checkbox) => {
      const cell = checkbox.closest("td");
      if (!cell) return;

      // Удаляем старый тултип, если есть
      const oldTooltip = cell.querySelector(".custom-tooltip");
      if (oldTooltip) oldTooltip.remove();

      const tooltip = document.createElement("div");
      tooltip.className = "custom-tooltip";

      // Ищем задачу, соответствующую уязвимости
      const task = data.find((task) =>
        task.findingUrl.includes(`/finding/${checkbox.id}`)
      );

      if (task) {
        const link = document.createElement("a");
        link.href = `${config.openproject.url}/projects/testproj/work_packages/${task.id}`;
        link.target = "_blank";
        link.innerText = `${task.id}`;
        link.style.color = "#3fa5cc";

        tooltip.innerHTML = `ID: `;
        tooltip.appendChild(link);
        tooltip.innerHTML += `;<br>Status: ${task.status};<br>Assignee: ${task.assignee};`;

        cell.style.backgroundColor =
          task.assignee === "N/A" ? "lightgreen" : "yellow";
      } else {
        tooltip.innerHTML = "ID: N/A;<br>Status: N/A;<br>Assignee: N/A;";
        cell.style.backgroundColor = "lightcoral";
      }

      cell.style.position = "relative";
      cell.appendChild(tooltip);

      // Навешиваем события на td (ячейку)
      cell.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
      });
      cell.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    });
  }

  //Расскоментировать, если хотите подсветку всей строки. Сделать то же самое в main.
  /*function highlightFindings(openprojectTasks) {
        const rows = document.querySelectorAll('tr.active_finding');
    
        rows.forEach(row => {
            const findingLink = row.querySelector('a[href*="/finding/"]');
            if (findingLink) {
                const findingId = findingLink.href.split('/').pop();
                const task = openprojectTasks.find(task => task.findingUrl.includes(`/finding/${findingId}`));
    
                if (task) {
                    if (task.assignee === 'N/A') {
                        row.style.backgroundColor = 'lightgreen';
                    } else {
                        row.style.backgroundColor = 'yellow';
                    }
                    console.log(`Finding ID ${findingId} exists in OpenProject, highlighted green or yellow.`);
                } else {
                    row.style.backgroundColor = 'lightcoral';
                    console.log(`Finding ID ${findingId} does not exist in OpenProject, highlighted red.`);
                }
            }
        });
    }*/

  // CSS: Добавление стилей для модального окна и тултипов
  function addCustomStyles() {
    if (document.getElementById("op-custom-styles")) return;
    const style = document.createElement("style");
    style.id = "op-custom-styles";
    style.textContent = `
      .op-modal {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
      }
      .op-modal-box {
        background: #fff;
        padding: 24px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        min-width: 320px;
        text-align: center;
      }
      .op-modal-label {
        display: block;
        margin-bottom: 12px;
        font-weight: bold;
      }
      .op-modal-form {
        text-align: left;
        margin-bottom: 16px;
      }
      .op-btn {
        padding: 6px 18px;
        border-radius: 4px;
        border: 1px solid #bbb;
        background: #f5f5f5;
        color: #222;
        cursor: pointer;
        font-size: 15px;
        margin: 0 2px;
      }
      .op-btn-primary {
        background: #3fa5cc;
        color: #fff;
        border: 1px solid #3fa5cc;
      }
      .op-btn:active {
        filter: brightness(0.95);
      }
      .custom-tooltip {
        position: absolute;
        display: none;
        min-width: 250px;
        max-width: 1000px;
        background-color: rgba(51, 51, 51, 0.85);
        color: #fff;
        text-align: left;
        border-radius: 6px;
        padding: 10px;
        z-index: 10001;
        top: -50%;
        left: 100%;
        white-space: normal;
        word-wrap: break-word;
      }
    `;
    document.head.appendChild(style);
  }

  // ========== ДОБАВЛЯЕМ CSS СТИЛИ ДЛЯ УВЕДОМЛЕНИЙ И КНОПКИ ==========
  (function addNotificationStyles() {
    if (document.getElementById("dd-notification-styles")) return;
    const style = document.createElement("style");
    style.id = "dd-notification-styles";
    style.textContent = `
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
      .dd-fixed-send-btn {
        position: fixed !important;
        bottom: 32px;
        right: 32px;
        z-index: 10010;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        background: linear-gradient(90deg, #1bcf4c 0%, #0e9e2a 100%);
        color: #fff !important;
        font-size: 18px;
        font-weight: bold;
        border: none;
        padding: 14px 32px;
        border-radius: 8px;
        display: none;
        transition: opacity 0.2s, box-shadow 0.2s;
        opacity: 0.95;
      }
      .dd-fixed-send-btn.visible {
        display: block;
      }
      .dd-fixed-send-btn:hover {
        box-shadow: 0 8px 32px rgba(27,207,76,0.25);
        opacity: 1;
        filter: brightness(1.08);
      }
    `;
    document.head.appendChild(style);
  })();

  // ========== МОДЕЛЬ УВЕДОМЛЕНИЙ ==========
  function showNotification(message, type = "info", duration = 3000) {
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll(".dd-notification");
    existingNotifications.forEach((notification) => notification.remove());

    const notification = document.createElement("div");
    notification.className = `dd-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Показываем уведомление
    setTimeout(() => notification.classList.add("show"), 10);

    // Скрываем через указанное время
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // Пример использования:
  // showNotification('Сообщение', 'success');
  // showNotification('Ошибка', 'error');
  // showNotification('Внимание', 'warning');
  // showNotification('Информация', 'info');

  // Добавление фиксированной кнопки отправки
  function addFixedSendButton() {
    let button = document.getElementById("dd-fixed-send-btn");
    if (!button) {
      button = document.createElement("button");
      button.id = "dd-fixed-send-btn";
      button.className = "dd-fixed-send-btn";
      button.type = "button";
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:8px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        Отправить в OpenProject`;
      button.onclick = handleButtonClick;
      document.body.appendChild(button);
    }

    function updateButtonVisibility() {
      const checked = document.querySelectorAll(
        'input[type="checkbox"].select_one:checked'
      ).length;
      if (checked > 0) {
        button.classList.add("visible");
      } else {
        button.classList.remove("visible");
      }
    }

    // Навешиваем обработчик на все чекбоксы (и при изменении DOM)
    document.addEventListener("change", function (e) {
      if (e.target.matches('input[type="checkbox"].select_one')) {
        updateButtonVisibility();
      }
    });

    // Первичная инициализация
    updateButtonVisibility();
  }

  // Main функция для запроса данных и добавления тултипа
  async function main() {
    addCustomStyles();
    addFixedSendButton();
    try {
      const openProjectData = await fetchOpenProjectData(
        openprojectUrl,
        openprojectAuth
      );
      const parsedOpenProjectData = parseOpenProjectData(openProjectData);
      //highlightFindings(parsedOpenProjectData);
      console.log("Parsed OpenProject Data:", parsedOpenProjectData);

      createTooltips(parsedOpenProjectData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    addButton();
  }

  // Запуск main функции
  window.addEventListener("load", main);
})();
