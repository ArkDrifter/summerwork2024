// ==UserScript==
// @name         DefectDojo Plugin
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Отправляет уязвимости в OpenProject, подсвечивает их при определенных условиях
// @author       Marauder
// @match        https://demo.defectdojo.org/finding*
// @match        https://demo.defectdojo.org/product/*/finding/*
// @grant        GM_xmlhttpRequest
// @homepageURL  https://github.com/ArkDrifter/summerwork2024/issues
// @updateURL    https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// @downloadURL  https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js
// ==/UserScript==

(function ($) {
  "use strict";

  // OpenProject API настройки
  const openprojectUrl =
    "https://YOUR_OPENPROJECT_DOMAIN/api/v3/projects/PROJECT_ID/work_packages"; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: https://localhost:8080/api/v3/projects/3/work_packages
  const apiKeyOP = "your_api_key"; //Ключ в https://localhost:8080/my/access_token
  const creatingApiToken = btoa(`apikey:${apiKeyOP}`); //Ключ кодируется в base64
  const openprojectAuth = `Basic ${creatingApiToken}`;

  // DefectDojo API настройки
  const defectDojoUrl = "https://YOUR_DEFECTDOJO_DOMAIN/api/v2/"; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: https://demo.defectdojo.org/api/v2/
  const defectDojoToken = "Token YOUR_API_TOKEN"; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Ключ в https://your_defectdojo_domain/api/key-v2

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
    console.log("Selected Findings:", findingIds);

    fetchOpenProjectTasks((openprojectTasks) => {
      processFindings(findingIds, openprojectTasks);
    });
  }

  // Функция для обработки уязвимостей
  function processFindings(findingIds, openprojectTasks) {
    fetchFindingsData(
      findingIds.map((finding) => finding.id),
      (findings) => {
        findings.forEach((finding, index) => {
          finding.engagementLink = findingIds[index].engagementLink;
          finding.productLink = findingIds[index].productLink;
          processFinding(finding, openprojectTasks);
        });
        console.log("Findings Data:", findings);
        alert(`Processed ${findings.length} findings for OpenProject`);
      }
    );
  }

  // Функция для обработки отдельной уязвимости
  function processFinding(finding, openprojectTasks) {
    getProductAndEngagementNames(finding, (productAndEngagementNames) => {
      finding.productName = productAndEngagementNames.productName;
      finding.engagementName = productAndEngagementNames.engagementName;
      createOpenProjectTaskIfNotExists(finding, openprojectTasks);
    });
  }

  // Функция для извлечения ID уязвимостей
  function extractFindingId(row) {
    const findingUrl =
      row.querySelector("a[title]")?.getAttribute("href") || "";
    return findingUrl.split("/").pop();
  }

  // Функция для извлечения ссылки на engagement
  function extractEngagementLink(row) {
    const engagementLink = row
      .querySelector("a[href*='/engagement/']")
      .getAttribute("href");
    const fullEngagementLink = `https://YOUR_DEFECTDOJO_DOMAIN${engagementLink}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: https://demo.defectdojo.org
    // Удаляем часть URL, начиная с '/risk_acceptance'
    return fullEngagementLink.split("/risk_acceptance")[0];
  }

  // Функция для извлечения ссылки на product
  function extractProductLink(row) {
    const productLink = row
      .querySelector("a[href*='/product/']")
      .getAttribute("href");
    const fullProductLink = `https://YOUR_DEFECTDOJO_DOMAIN${productLink}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: https://demo.defectdojo.org
    return fullProductLink;
  }

  // Функция для получения данных о выбранных уязвимостях
  function extractSelectedFindings() {
    const findingIds = [];
    document
      .querySelectorAll('tr.active_finding input[type="checkbox"]:checked')
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

  // Функция для получения данных OpenProject с помощью GM_xmlhttpRequest
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

  // Запрос данных OpenProject
  function parseOpenProjectData(data) {
    return data._embedded.elements.map((task) => {
      const findingUrlMatch = task.description.raw.match(
        /https:\/\/YOUR_DEFECTDOJO_DOMAIN\/finding\/(\d+)/
      ); //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: /https:\/\/demo.defectdojo.org\/finding\/(\d+)/
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

  // Функция задержки
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Функция для получения данных из DefectDojo API о найденных уязвимостях
  async function fetchFindingsData(findingIds, callback) {
    const findings = [];
    const delayMs = 100; // Задержка между запросами в мс
    let requestsCompleted = 0;

    for (const id of findingIds) {
      await delay(delayMs); // Задержка перед следующим запросом
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

  // Функция для получения имен продукта и engagement
  function getProductAndEngagementNames(finding, callback) {
    let productName = "N/A";
    let engagementName = "N/A";

    const fetchProductName = new Promise((resolve, reject) => {
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

    const fetchEngagementName = new Promise((resolve, reject) => {
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

  // Функция для получения задач из OpenProject
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
    const findingUrl = `https://YOUR_DEFECTDOJO_DOMAIN/finding/${id}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: https://demo.defectdojo.org/finding/

    // Проверяем, существует ли уже задача в OpenProject
    const taskExists = openprojectTasks.some((task) =>
      task.description.raw.includes(findingUrl)
    );
    if (taskExists) {
      alert(
        `Task for finding ID ${id} already exists in OpenProject. Skipping creation.`
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

    // Отправляем данные в OpenProject
    const taskData = {
      subject: finding.title,
      description: {
        format: "markdown",
        raw: `**Finding ID/URL:** [${id}](${findingUrl})\n**CWE:** ${cweText}\n**Vulnerability IDs:** ${vulnerabilityLinks}\n**Severity:** ${severityText}\n**Product Link:** ${productLinkMarkdown}\n**Engagement Link:** ${engagementLinkMarkdown}\n\n**Description:** \n\n ${description}`,
      },
      project: {
        href: "/api/v3/projects/YOUR_PROJECT_ID", //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: "/api/v3/projects/3" или "/api/v3/projects/demoDefect "(Имя проекта)
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
          console.log(`Task created for finding: ${finding.title}`);
        } else {
          console.error(
            `Failed to create task: ${response.status} - ${response.statusText}`
          );
          console.error(response.responseText);
        }
      },
      onerror: (error) => {
        console.error("Error creating task:", error);
      },
    });
  }

  // Функция создания и добавления тултипа в поле чекбокса
  function createTooltips(data) {
    // Выбираем все чекбоксы уязвимостей
    const checkboxes = document.querySelectorAll(
      ".active_finding .noVis:first-child form input"
    );
    const processedIds = []; // Массив для хранения обработанных ID

    checkboxes.forEach((checkbox) => {
      if (checkbox.parentElement && checkbox.parentElement.parentElement) {
        const row = checkbox.parentElement.parentElement;
        row.style.position = "relative";

        const tooltip = document.createElement("div");
        tooltip.className = "custom-tooltip";
        tooltip.style.position = "absolute";
        tooltip.style.display = "none";
        tooltip.style.minWidth = "250px";
        tooltip.style.maxWidth = "1000px";
        tooltip.style.backgroundColor = "rgba(51, 51, 51, 0.85)";
        tooltip.style.color = "#fff";
        tooltip.style.textAlign = "left";
        tooltip.style.borderRadius = "6px";
        tooltip.style.padding = "10px";
        tooltip.style.zIndex = "10001";
        tooltip.style.top = "-50%";
        tooltip.style.left = "100%";
        tooltip.style.whiteSpace = "normal";
        tooltip.style.wordWrap = "break-word";

        // Ищем задачу, соответствующую уязвимости
        const task = data.find((task) =>
          task.findingUrl.includes(`/finding/${checkbox.id}`)
        );

        if (task) {
          const link = document.createElement("a");
          link.href = `https://YOUR_OPENPROJECT_DOMAIN/projects/YOUR_PROJECT_ID/work_packages/${task.id}`; //ЗАМЕНИТЬ ИНФОРМАЦИЮ. Example: `https://localhost:8080/projects/3/work_packages/
          link.target = "_blank";
          link.innerText = `${task.id}`;
          link.style.color = "#3fa5cc";

          tooltip.innerHTML = `ID: `;
          tooltip.appendChild(link);
          tooltip.innerHTML += `;<br>Status: ${task.status};<br>Assignee: ${task.assignee};`;

          // Подсветка полей чекбокса
          // Закомментировать эту часть, если используется подсветка целого поля уязвимости
          row.style.backgroundColor =
            task.assignee === "N/A" ? "lightgreen" : "yellow";
        } else {
          tooltip.innerHTML = "ID: N/A;<br>Status: N/A;<br>Assignee: N/A;";
          row.style.backgroundColor = "lightcoral";
        }
        //

        row.appendChild(tooltip);

        // Добавляем события для показа и скрытия тултипа
        row.addEventListener("mouseover", () => {
          tooltip.style.display = "block";
        });

        row.addEventListener("mouseout", () => {
          tooltip.style.display = "none";
        });

        processedIds.push(checkbox.id);
      }
    });

    console.log("Processed IDs for tooltips:", processedIds);
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

  // Main функция для запроса данных и добавления тултипа
  async function main() {
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
})(jQuery);
