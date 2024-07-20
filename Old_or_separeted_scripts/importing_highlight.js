// ==UserScript==
// @name         Highlight DefectDojo Findings
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Подсвечивает уязвимости в DefectDojo на основе наличия задач в OpenProject
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

    // Добавляем кнопку на страницу DefectDojo
    function addButton() {
        const btnGroup = document.querySelector(".dt-buttons.btn-group");
        if (btnGroup) {
            const button = document.createElement("button");
            button.className = "btn btn-default";
            button.type = "button";
            button.innerHTML = "<span>Check OpenProject</span>";
            button.onclick = handleButtonClick;
            btnGroup.appendChild(button);
            console.log("Button 'Check OpenProject' added.");
        } else {
            console.error("Button group not found.");
        }
    }

    // Функция для обработки клика по кнопке
    function handleButtonClick() {
        console.log("Button 'Check OpenProject' clicked.");
        const findingIds = extractFindingIds();
        console.log("Extracted finding IDs:", findingIds);
        fetchOpenProjectTasks(openprojectTasks => {
            console.log("Fetched OpenProject tasks:", openprojectTasks);
            highlightFindings(findingIds, openprojectTasks);
        });
    }

    // Функция для извлечения ID уязвимостей из DefectDojo
    function extractFindingIds() {
        const findingIds = [];
        document.querySelectorAll("tr.active_finding").forEach(row => {
            const findingUrl = row.querySelector("a[title]")?.getAttribute("href") || "";
            const findingId = findingUrl.split("/").pop();
            if (findingId) {
                findingIds.push(findingId);
            }
        });
        return findingIds;
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

    // Функция для подсветки уязвимостей в DefectDojo на основе наличия задач в OpenProject
    function highlightFindings(findingIds, openprojectTasks) {
        findingIds.forEach(findingId => {
            const row = document.querySelector(`tr.active_finding a[href*="/finding/${findingId}"]`).closest("tr");
            const taskExists = openprojectTasks.some(task => task.description.raw.includes(`https://demo.defectdojo.org/finding/${findingId}`));
            if (taskExists) {
                row.style.backgroundColor = "lightgreen";
                console.log(`Finding ID ${findingId} exists in OpenProject, highlighted green.`);
            } else {
                row.style.backgroundColor = "lightcoral";
                console.log(`Finding ID ${findingId} does not exist in OpenProject, highlighted red.`);
            }
        });
    }

    // Запуск добавления кнопки при загрузке страницы
    window.addEventListener("load", () => {
        addButton();
    });

})(jQuery);
