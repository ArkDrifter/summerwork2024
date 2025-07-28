# **_/summerwork/_** Plugin for DefectDojo 🧏‍♂️.

![visitor badge](https://visitor-badge.laobi.icu/badge?page_id=ArkDrifter.summerwork2024)

<p align="center">
  <img width="400" height="250" src="https://sun9-65.userapi.com/impg/wOmndm1prNRuqVwXis9at_Z4BaV9n7L-haPFSg/1iI2-wXVj1U.jpg?size=640x640&quality=95&sign=640a7d0388c6395e36a7640b13836872&type=album" alt=💀>
</p>
<p class align="center">💀</p>

## Функционал ⚙️

1. **_Переносит_** информацию об уязвимости в OpenProject. Подробная информация и ссылки записываются в **_описание_**.
2. Отображается **_информация_** о существующих задачах в OpenProject. Она находится в **_области чекбоксов_** и выводится в окне.\
   Содержит **_ссылку на id_** задачи в OpenProject, **_статус работы_** и **_имя пользователя_** который этой задачей занимается. Также добавлена ссылка на **_проект_**, в котором находится задача.

3. **_Подсвечивает_** строки/чекбоксы в зависимости от **_назначенного работника_** и существования задачи.

   - Зеленый - существует задача в OP.

   - Желтый - задача отдана кому-то.

   - Красный - задачи не существует.

> [!WARNING]
> Если нужна **_корректная_** подсветка и отображение всех задач, то нужно убрать в настройках статусов **_автозакрытие_** и также настроить **_отображение количества_** задач на странице OpenProject.
>
> Это связано с тем, что в API ответ будет содержать не все задачи.

<hr>

> [!CAUTION]
> При выборе больше 15 уязвимостей за раз и переносе в OpenProject появляются ошибки обработки данных.
>
> Чтобы решить её сделана оптимальная задержка между запросами. Настраивайте её на своё усмотрение.

<hr>

## Как использовать: ❔

1. Включить ["Developer Mode"](https://www.tampermonkey.net/faq.php#Q209) в расширениях браузера. 🐵

2. Загрузить [Tampermonkey](https://www.tampermonkey.net/index.php) ⬇️

3. **[«Установите Скрипт»](https://raw.githubusercontent.com/ArkDrifter/summerwork2024/main/DefectDojo_Plugin.js)** ✔️

## Что использовалось: ❓

1. OpenProject:

   - 🐳 Docker: https://hub.docker.com/r/openproject/openproject?uuid=FF6F4ABB-2650-41A2-9EC1-418FDF6E435F

   - 📰 Документация API: https://www.openproject.org/docs/installation-and-operations/installation/docker/

2. DefectDojo:

   - ❔ Как собрать образ для Docker: https://github.com/DefectDojo/django-DefectDojo/blob/master/readme-docs/DOCKER.md

   - Git: https://github.com/DefectDojo/django-DefectDojo

   - 🌐 Демо-сайт: https://demo.defectdojo.org/

   - 📰 Документация API: https://defectdojo.github.io/django-DefectDojo/integrations/api-v2-docs/

3. [Tampermonkey](https://www.tampermonkey.net/index.php)
