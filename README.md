# summerwork2024
Plugin for DefectDojo.

Переносит информацию об уязвимости в OpenProject.
Подробная информация и ссылки записываются в описание.
Также соотносится информация о задачах для DefectDojo. Отображается в тултипах при наведении в область чекбоксов. Содержит ссылку и номер id задачи в OpenProject, статус работы и имя пользователя, который этой задачей занимается.
Также если нужно отображение и корректная подсветка задачи со статусом, который автоматически закрывает задачу, то нужно это убрать ибо в api оно не отобразится.

Возможные ошибки:
При выборе больше 15 уязвимостей за раз и переносе в OpenProject появляются ошибки обработки данных. Чтобы решить её сделана оптимальная задержка между запросами. 

Надеюсь это как-то поможет для дальнейшей разработки проекта :)

Что использовалось:
Docker:
    -Docker OP: https://hub.docker.com/r/openproject/openproject?uuid=FF6F4ABB-2650-41A2-9EC1-418FDF6E435F
                https://www.openproject.org/docs/installation-and-operations/installation/docker/
    -Docker DD: https://github.com/DefectDojo/django-DefectDojo/blob/master/readme-docs/DOCKER.md
                https://github.com/DefectDojo/django-DefectDojo
                И их демо сайт: https://demo.defectdojo.org/

API DefectDojo/OpenProject;
    - OP: https://www.openproject.org/docs/api/
    - DD: https://defectdojo.github.io/django-DefectDojo/integrations/api-v2-docs/

Tampermonkey: https://www.tampermonkey.net/index.php

