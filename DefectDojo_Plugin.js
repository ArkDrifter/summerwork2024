// ==UserScript==
// @name         DefectDojo Plugin
// @namespace    http://tampermonkey.net/
// @version      0.5.3
// @description  Отправляет уязвимости в OpenProject, подсвечивает их при определенных условиях
// @author       Marauder
// @match        https://demo.defectdojo.org/finding*
// @match        https://demo.defectdojo.org/product/*/finding/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @homepageURL  https://github.com/ArkDrifter/summerwork2024/issues
// @updateURL    https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// @downloadURL  https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// ==/UserScript==

(function () {
  "use strict";

  // ====================================
  // 1. CONFIGURATION
  // ====================================
  const config = {
    openproject: {
      url: "http://localhost:8085", //URL OpenProject (Например, http://localhost:8085)
      apiKey: "Your_API_Key",
      workPackagesPath: "/api/v3/work_packages",
      projectsPath: "/api/v3/projects",
    },
    defectdojo: {
      url: "https://Your_DefectDojo_URL", //URL DefectDojo (Например, https://demo.defectdojo.org)
      apiPath: "/api/v2/",
      token: "Token Your_API_Key",
    },
  };

  // ====================================
  // 2. INITIALIZATION & CONSTANTS
  // ====================================
  // Формируем URL для API OpenProject и авторизационные данные

  // URL для работы с задачами OpenProject (например: http://localhost:8085/api/v3/work_packages)
  const openProjectWorkPackagesUrl =
    config.openproject.url + config.openproject.workPackagesPath;

  // Токен API OpenProject в формате Base64
  const openProjectApiToken = btoa(`apikey:${config.openproject.apiKey}`);

  // Заголовок авторизации для OpenProject (Basic Auth)
  const openProjectAuthHeader = `Basic ${openProjectApiToken}`;

  // URL для работы с проектами OpenProject (например: http://localhost:8085/api/v3/projects)
  const openProjectProjectsUrl =
    config.openproject.url + config.openproject.projectsPath;

  // URL API DefectDojo (например: https://demo.defectdojo.org/api/v2/)
  const defectDojoApiUrl = config.defectdojo.url + config.defectdojo.apiPath;

  // Токен авторизации для DefectDojo API
  const defectDojoAuthToken = config.defectdojo.token;

  // ====================================
  // 3. UTILITY FUNCTIONS
  // ====================================

  // Функция для создания задержки между запросами
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Функция для отображения уведомлений пользователю
  function showNotification(message, type = "info", duration = 3000) {
    const existingNotifications = document.querySelectorAll(".dd-notification");
    existingNotifications.forEach((notification) => notification.remove());

    const notification = document.createElement("div");
    notification.className = `dd-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // ====================================
  // 4. DEFECTDOJO API FUNCTIONS
  // ====================================
  // Функция для получения данных уязвимостей из DefectDojo API
  // Принимает массив ID уязвимостей и callback для обработки результатов
  async function fetchFindingsData(findingIds, callback) {
    const findings = [];
    const delayMs = 100; // Задержка между запросами
    let requestsCompleted = 0;

    for (const id of findingIds) {
      await delay(delayMs);
      GM_xmlhttpRequest({
        method: "GET",
        url: `${defectDojoApiUrl}findings/${id}/`,
        headers: {
          Authorization: defectDojoAuthToken,
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

  // Функция для получения названий продукта и engagement из DefectDojo
  // Использует параллельные запросы
  function getProductAndEngagementNames(finding, callback) {
    let productName = "N/A";
    let engagementName = "N/A";

    // Запрос для получения названия продукта
    const fetchProductName = new Promise((resolve) => {
      if (finding.productLink) {
        const productId = finding.productLink.split("/").pop();
        GM_xmlhttpRequest({
          method: "GET",
          url: `${defectDojoApiUrl}products/${productId}/`,
          headers: {
            Authorization: defectDojoAuthToken,
            "Content-Type": "application/json",
          },
          onload: (response) => {
            if (response.status === 200) {
              const product = JSON.parse(response.responseText);
              productName = product.name;
            }
            resolve();
          },
          onerror: () => resolve(),
        });
      } else {
        resolve();
      }
    });

    // Запрос для получения названия engagement
    const fetchEngagementName = new Promise((resolve) => {
      if (finding.engagementLink) {
        const engagementId = finding.engagementLink.split("/").pop();
        GM_xmlhttpRequest({
          method: "GET",
          url: `${defectDojoApiUrl}engagements/${engagementId}/`,
          headers: {
            Authorization: defectDojoAuthToken,
            "Content-Type": "application/json",
          },
          onload: (response) => {
            if (response.status === 200) {
              const engagement = JSON.parse(response.responseText);
              engagementName = engagement.name;
            }
            resolve();
          },
          onerror: () => resolve(),
        });
      } else {
        resolve();
      }
    });

    // Ждем завершения обоих запросов и возвращаем результат
    Promise.all([fetchProductName, fetchEngagementName]).then(() => {
      callback({
        productName: productName,
        engagementName: engagementName,
      });
    });
  }

  // ====================================
  // 5. OPENPROJECT API FUNCTIONS
  // ====================================

  // Универсальная функция для запросов к OpenProject API
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

  // Функция для получения списка проектов из OpenProject
  function fetchOpenProjectProjects(callback) {
    GM_xmlhttpRequest({
      method: "GET",
      url: openProjectProjectsUrl,
      headers: {
        Authorization: openProjectAuthHeader,
        "Content-Type": "application/json",
      },
      onload: (response) => {
        if (response.status === 200) {
          const data = JSON.parse(response.responseText);
          console.log("OpenProject projects data:", data._embedded.elements);
          callback(data._embedded.elements);
        } else {
          showNotification(
            "Ошибка при получении списка проектов OpenProject",
            "error"
          );
          callback([]);
        }
      },
      onerror: () => {
        showNotification(
          "Ошибка при получении списка проектов OpenProject",
          "error"
        );
        callback([]);
      },
    });
  }

  // Функция для парсинга данных задач OpenProject
  // Извлекает информацию о задачах и связывает их с уязвимостями DefectDojo
  function parseOpenProjectData(data) {
    return data._embedded.elements
      .map((task) => {
        let findingUrl = "N/A";
        let findingId = null;

        if (task.description?.raw) {
          const urlMatch = task.description.raw.match(
            /https?:\/\/[^/]+\/finding\/(\d+)/
          );
          if (urlMatch) {
            findingUrl = urlMatch[0];
            findingId = urlMatch[1];
          }

          console.log(`Извлечен findingId: ${findingId} из задачи ${task.id}`);
        }

        return {
          id: task.id,
          status: task._links?.status?.title || "Unknown",
          assignee: task._links?.assignee?.title || "N/A",
          findingUrl: findingUrl,
          findingId: findingId,
          project: task._links?.project || null,
        };
      })
      .filter((task) => task.findingId !== null); // Фильтруем только задачи с найденными уязвимостями
  }

  // Функция для получения всех задач из OpenProject
  function fetchOpenProjectTasks(callback) {
    GM_xmlhttpRequest({
      method: "GET",
      url: openProjectWorkPackagesUrl,
      headers: {
        Authorization: openProjectAuthHeader,
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

  // ====================================
  // 6. UI COMPONENTS
  // ====================================

  // Функция для создания модального окна выбора проектов
  // Позволяет пользователю выбрать в какие проекты отправлять задачи
  function showProjectSelectModal(projects, onSelect) {
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

  // Функция для добавления кнопки в панель инструментов DefectDojo
  function addButton() {
    const btnGroup = document.querySelector(".dt-buttons.btn-group");
    if (!btnGroup) return;

    const button = document.createElement("button");
    button.className = "btn btn-default";
    button.type = "button";
    button.innerHTML = "<span>Отправить в OpenProject</span>";
    button.addEventListener("click", handleButtonClick);
    btnGroup.appendChild(button);
  }

  // Функция для создания фиксированной кнопки отправки
  // Появляется только когда выбраны уязвимости
  function addFixedSendButton() {
    let button = document.getElementById("dd-fixed-send-btn");
    if (button) return;

    button = document.createElement("button");
    button.id = "dd-fixed-send-btn";
    button.className = "dd-fixed-send-btn";
    button.type = "button";
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:8px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      Отправить в OpenProject`;
    button.onclick = handleButtonClick;
    document.body.appendChild(button);

    // Функция для обновления видимости кнопки в зависимости от выбора уязвимостей
    function updateButtonVisibility() {
      const checked = document.querySelectorAll(
        'input[type="checkbox"].select_one:checked'
      ).length;
      button.classList.toggle("visible", checked > 0);
    }

    // Слушаем изменения в чекбоксах для обновления видимости кнопки
    document.addEventListener("change", function (e) {
      if (e.target.matches('input[type="checkbox"].select_one')) {
        updateButtonVisibility();
      }
    });

    updateButtonVisibility();
  }

  // Функция для создания всплывающих подсказок с информацией о задачах
  // Подсвечивает строки таблицы в зависимости от статуса задач
  function createTooltips(data) {
    fetchOpenProjectProjects((projects) => {
      console.log("Projects for tooltips:", projects);

      const checkboxes = document.querySelectorAll(
        'input[type="checkbox"].select_one'
      );
      checkboxes.forEach((checkbox) => {
        const cell = checkbox.closest("td");
        if (!cell) return;

        const oldTooltip = cell.querySelector(".custom-tooltip");
        if (oldTooltip) oldTooltip.remove();

        // Получаем ID уязвимости из строки
        const row = checkbox.closest("tr");
        if (!row) return;

        const findingId = extractFindingId(row);
        if (!findingId) {
          console.error("Не удалось извлечь ID уязвимости для строки", row);
          return;
        }

        // Ищем задачи для этой уязвимости по ID
        const tasks = data.filter((task) => task.findingId === findingId);

        console.log(`Поиск задач для уязвимости ${findingId}:`, tasks);

        if (tasks.length > 0) {
          console.log("Tasks for finding", findingId, ":", tasks);
          // Подсвечиваем строку: зеленый если нет исполнителя, желтый если есть
          cell.style.backgroundColor =
            tasks[0].assignee === "N/A" ? "lightgreen" : "yellow";

          // Создаем тултип только для уязвимостей с задачами
          const tooltip = document.createElement("div");
          tooltip.className = "custom-tooltip";

          // Создаем заголовок тултипа
          const headerDiv = document.createElement("div");
          headerDiv.className = "custom-tooltip-header";
          headerDiv.textContent = `Информация о задачах (${tasks.length})`;
          tooltip.appendChild(headerDiv);

          // Контейнер для содержимого
          const contentDiv = document.createElement("div");
          contentDiv.className = "custom-tooltip-content";
          tooltip.appendChild(contentDiv);

          // Перебираем все задачи для данной уязвимости
          tasks.forEach((task, index) => {
            let projectId = "";
            let projectName = "Unknown";

            if (task.project) {
              projectName = task.project.title || "Unknown";

              if (task.project.href) {
                const projectIdMatch =
                  task.project.href.match(/\/projects\/(\w+)/);
                if (projectIdMatch && projectIdMatch[1]) {
                  projectId = projectIdMatch[1];
                }
              }
            }

            console.log(
              `Task ${task.id} - Project Name: ${projectName}, Project ID: ${projectId}`
            );

            // Формируем URL для задачи и проекта
            let taskUrl;
            if (projectId) {
              taskUrl = `${config.openproject.url}/projects/${projectId}/work_packages/${task.id}`;
            } else {
              taskUrl = `${config.openproject.url}/work_packages/${task.id}`;
            }

            let projectUrl = "";
            if (projectId) {
              projectUrl = `${config.openproject.url}/projects/${projectId}`;
            }

            // Создаем блок информации о задаче
            const taskDiv = document.createElement("div");
            taskDiv.className = "custom-tooltip-task";
            contentDiv.appendChild(taskDiv);

            // Заголовок задачи
            const taskTitle = document.createElement("div");
            taskTitle.style.fontSize = "16px";
            taskTitle.style.fontWeight = "bold";
            taskTitle.style.marginBottom = "8px";
            taskTitle.innerHTML = `Задача #${task.id}`;
            taskDiv.appendChild(taskTitle);

            // Строка с ID задачи
            const idRow = document.createElement("div");
            idRow.className = "custom-tooltip-row";

            const idLabel = document.createElement("span");
            idLabel.className = "custom-tooltip-label";
            idLabel.textContent = "ID:";

            const idValue = document.createElement("span");
            idValue.className = "custom-tooltip-value";

            const taskLink = document.createElement("a");
            taskLink.href = taskUrl;
            taskLink.target = "_blank";
            taskLink.textContent = task.id;

            idValue.appendChild(taskLink);
            idRow.appendChild(idLabel);
            idRow.appendChild(idValue);
            taskDiv.appendChild(idRow);

            // Строка с проектом
            const projectRow = document.createElement("div");
            projectRow.className = "custom-tooltip-row";

            const projectLabel = document.createElement("span");
            projectLabel.className = "custom-tooltip-label";
            projectLabel.textContent = "Проект:";

            const projectValue = document.createElement("span");
            projectValue.className = "custom-tooltip-value";

            if (projectUrl) {
              const projectLink = document.createElement("a");
              projectLink.href = projectUrl;
              projectLink.target = "_blank";
              projectLink.textContent = projectName;
              projectValue.appendChild(projectLink);
            } else {
              projectValue.textContent = projectName;
            }

            projectRow.appendChild(projectLabel);
            projectRow.appendChild(projectValue);
            taskDiv.appendChild(projectRow);

            // Строка со статусом
            const statusRow = document.createElement("div");
            statusRow.className = "custom-tooltip-row";

            const statusLabel = document.createElement("span");
            statusLabel.className = "custom-tooltip-label";
            statusLabel.textContent = "Статус:";

            const statusValue = document.createElement("span");
            statusValue.className = "custom-tooltip-value";

            // Визуальный бейдж для статуса
            const statusBadge = document.createElement("span");
            statusBadge.className = "custom-tooltip-badge";

            // Определяем цвет бейджа в зависимости от статуса
            const status = task.status?.toLowerCase() || "";
            if (status.includes("new")) {
              statusBadge.classList.add("info");
            } else if (status.includes("in progress")) {
              statusBadge.classList.add("medium");
            } else if (status.includes("closed")) {
              statusBadge.classList.add("low");
            } else {
              statusBadge.classList.add("high");
            }

            statusBadge.textContent = task.status;
            statusValue.appendChild(statusBadge);

            statusRow.appendChild(statusLabel);
            statusRow.appendChild(statusValue);
            taskDiv.appendChild(statusRow);

            // Строка с исполнителем
            const assigneeRow = document.createElement("div");
            assigneeRow.className = "custom-tooltip-row";

            const assigneeLabel = document.createElement("span");
            assigneeLabel.className = "custom-tooltip-label";
            assigneeLabel.textContent = "Исполнитель:";

            const assigneeValue = document.createElement("span");
            assigneeValue.className = "custom-tooltip-value";
            assigneeValue.textContent = task.assignee;

            assigneeRow.appendChild(assigneeLabel);
            assigneeRow.appendChild(assigneeValue);
            taskDiv.appendChild(assigneeRow);
          });

          // Тултип только для строк с задачами
          cell.style.position = "relative";
          cell.appendChild(tooltip);

          let tooltipActive = false;
          let hideTimeout = null;

          // Показываем тултип при наведении на ячейку
          cell.addEventListener("mouseenter", () => {
            tooltipActive = true;
            clearTimeout(hideTimeout);
            tooltip.style.display = "block";
            tooltip.style.opacity = "1";
          });

          const hideTooltip = () => {
            if (tooltipActive) return;
            hideTimeout = setTimeout(() => {
              tooltip.style.opacity = "0";
              setTimeout(() => {
                if (!tooltipActive) tooltip.style.display = "none";
              }, 200);
            }, 300);
          };

          cell.addEventListener("mouseleave", () => {
            tooltipActive = false;
            hideTooltip();
          });

          tooltip.addEventListener("mouseenter", () => {
            tooltipActive = true;
            clearTimeout(hideTimeout);
            tooltip.style.display = "block";
            tooltip.style.opacity = "1";
          });

          tooltip.addEventListener("mouseleave", () => {
            tooltipActive = false;
            hideTooltip();
          });
        } else {
          // Если задач нет - подсвечиваем красным
          cell.style.backgroundColor = "lightcoral";
        }
      });
    });
  }

  // ====================================
  // 7. DATA EXTRACTION & PROCESSING
  // ====================================

  // Функция для извлечения ID уязвимости из строки таблицы
  function extractFindingId(row) {
    const findingLink = row.querySelector("a[href*='/finding/']");
    if (findingLink) {
      const match = findingLink.getAttribute("href").match(/\/finding\/(\d+)/);
      if (match) return match[1];
    }
    return null;
  }

  // Функция для извлечения ссылки на engagement из строки
  function extractEngagementLink(row) {
    try {
      const engagementElement = row.querySelector("a[href*='/engagement/']");
      if (!engagementElement) return "N/A";

      const engagementLink = engagementElement.getAttribute("href");
      return engagementLink
        ? `${config.defectdojo.url}${engagementLink}`.split(
            "/risk_acceptance"
          )[0]
        : "N/A";
    } catch (error) {
      console.error("Error extracting engagement link:", error);
      return "N/A";
    }
  }

  // Функция для извлечения ссылки на продукт из строки
  function extractProductLink(row) {
    try {
      const productElement = row.querySelector("a[href*='/product/']");
      if (!productElement) return "N/A";

      const productLink = productElement.getAttribute("href");
      return productLink ? `${config.defectdojo.url}${productLink}` : "N/A";
    } catch (error) {
      console.error("Error extracting product link:", error);
      return "N/A";
    }
  }

  // Функция для извлечения выбранных уязвимостей из таблицы
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

  // ====================================
  // 8. TASK CREATION & MANAGEMENT
  // ====================================

  // Глобальная переменная для хранения выбранных проектов
  let selectedProjectHrefs = [];

  // Основная функция обработки клика по кнопке отправки
  function handleButtonClick() {
    const findingIds = extractSelectedFindings();
    if (findingIds.length === 0) {
      showNotification("Выберите хотя бы одну уязвимость", "warning");
      return;
    }

    // Получаем список проектов и показываем модальное окно выбора
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

  // Функция для обработки массива уязвимостей
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

  // Функция для обработки одной уязвимости
  function processFinding(finding, openprojectTasks) {
    getProductAndEngagementNames(finding, (productAndEngagementNames) => {
      finding.productName = productAndEngagementNames.productName;
      finding.engagementName = productAndEngagementNames.engagementName;
      createOpenProjectTaskIfNotExists(finding, openprojectTasks);
    });
  }

  // Функция для создания задачи в OpenProject (если она еще не существует)
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
    const findingUrl = `https://demo.defectdojo.org/finding/${id}`;

    // Для каждого выбранного проекта создаем задачу
    selectedProjectHrefs.forEach((projectHref) => {
      // Проверяем, не существует ли уже задача для этой уязвимости в данном проекте
      const taskExists = openprojectTasks.some(
        (task) =>
          task.description?.raw?.includes(findingUrl) &&
          task._links?.project?.href === projectHref
      );

      if (taskExists) {
        showNotification(
          `Задача для этой уязвимости ${id} уже существует в выбранном проекте.`,
          "warning"
        );
        return;
      }

      // Формируем ссылки на уязвимости CVE
      const vulnerabilityLinks =
        vulnerabilityIds?.length > 0
          ? vulnerabilityIds
              .map(
                (vul) =>
                  `[${vul.vulnerability_id}](https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vul.vulnerability_id})`
              )
              .join(", ")
          : "N/A";

      // Формируем ссылку на CWE
      const cweText = cwe
        ? `[CWE-${cwe}](https://cwe.mitre.org/data/definitions/${cwe}.html)`
        : "N/A";
      const severityText = severity || "N/A";
      const productLinkMarkdown = productName
        ? `[${productName}](${productLink})`
        : "N/A";
      const engagementLinkMarkdown = engagementName
        ? `[${engagementName}](${engagementLink})`
        : "N/A";

      // Формируем данные для создания задачи
      const taskData = {
        subject: finding.title,
        description: {
          format: "markdown",
          raw: `**Finding ID/URL:** [${id}](${findingUrl})\n**CWE:** ${cweText}\n**Vulnerability IDs:** ${vulnerabilityLinks}\n**Severity:** ${severityText}\n**Product Link:** ${productLinkMarkdown}\n**Engagement Link:** ${engagementLinkMarkdown}\n\n**Description:** \n\n ${description}`,
        },
        project: { href: projectHref },
      };

      // Отправляем запрос на создание задачи
      GM_xmlhttpRequest({
        method: "POST",
        url: openProjectWorkPackagesUrl,
        headers: {
          Authorization: openProjectAuthHeader,
          "Content-Type": "application/json",
        },
        data: JSON.stringify(taskData),
        onload: (response) => {
          if (response.status === 200 || response.status === 201) {
            showNotification(
              `Задача для уязвимости: ${finding.title} создана`,
              "success"
            );
            console.log(
              `Задача для уязвимости: ${finding.title} создана в проекте ${projectHref}`
            );
          } else {
            showNotification(
              `Не удалось создать задачу: ${response.status} - ${response.statusText}`,
              "error"
            );
            console.error(
              `Не удалось создать задачу: ${response.status} - ${response.statusText}`,
              response.responseText
            );
          }
        },
        onerror: (error) => {
          showNotification("Не удалось создать задачу", "error");
          console.error("Error creating task:", error);
        },
      });
    });
  }

  // ====================================
  // 9. STYLES
  // ====================================

  // Функция для добавления CSS стилей в страницу
  function addCustomStyles() {
    GM_addStyle(`
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
        min-width: 300px;
        max-width: 500px;
        background-color: #2c3e50;
        color: #ecf0f1;
        text-align: left;
        border-radius: 6px;
        padding: 0;
        z-index: 10001;
        top: -120%;
        left: 120%;
        white-space: normal;
        word-wrap: break-word;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        font-size: 14px;
        line-height: 1.5;
        transition: opacity 0.3s ease;
        opacity: 0;
        pointer-events: all;
      }
      .custom-tooltip-header {
        background-color: #34495e;
        color: white;
        padding: 10px 15px;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
        font-weight: bold;
        border-bottom: 1px solid #455a64;
      }
      .custom-tooltip-content {
        padding: 12px 15px;
      }
      .custom-tooltip-task {
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px dashed rgba(255,255,255,0.2);
      }
      .custom-tooltip-task:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      .custom-tooltip-label {
        font-weight: bold;
        margin-right: 5px;
        color: #95a5a6;
      }
      .custom-tooltip-value {
        color: #ecf0f1;
      }
      .custom-tooltip-row {
        margin-bottom: 5px;
        display: flex;
      }
      .custom-tooltip-row:last-child {
        margin-bottom: 0;
      }
      .custom-tooltip a {
        color: #3498db !important;
        text-decoration: none;
        transition: color 0.2s;
      }
      .custom-tooltip a:hover {
        color: #2980b9 !important;
        text-decoration: underline;
      }
      .custom-tooltip-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
      }
      .custom-tooltip-badge.high {
        background-color: #e74c3c;
      }
      .custom-tooltip-badge.medium {
        background-color: #f39c12;
      }
      .custom-tooltip-badge.low {
        background-color: #27ae60;
      }
      .custom-tooltip-badge.info {
        background-color: #3498db;
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
    `);
  }

  // ====================================
  // 10. INITIALIZATION
  // ====================================

  // Главная функция инициализации скрипта
  async function main() {
    addCustomStyles(); // Добавляем CSS стили
    addFixedSendButton(); // Создаем фиксированную кнопку отправки
    try {
      // Получаем данные из OpenProject и создаем подсказки
      const openProjectData = await fetchOpenProjectData(
        openProjectWorkPackagesUrl,
        openProjectAuthHeader
      );
      const parsedOpenProjectData = parseOpenProjectData(openProjectData);
      console.log("Parsed OpenProject Data:", parsedOpenProjectData);
      createTooltips(parsedOpenProjectData); // Создаем всплывающие подсказки
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    addButton(); // Добавляем кнопку в панель инструментов
  }

  // Запускаем скрипт после загрузки страницы
  window.addEventListener("load", main);
})();
