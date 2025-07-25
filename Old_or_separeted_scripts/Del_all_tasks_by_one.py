import requests

# Конфигурация
BASE_URL = 'http://localhost:8088/api/v3'
PROJECT_ID = '3'
API_TOKEN = 'YXBpa2V5OmM2ZDM5Njg0NmVlNTBhNDYwZTg2N2M4MjcwYzQzODVjNzk0YTlhOGQzNzg0OGIxNjdkZmNkNGNiODBkNmRmMGE='

# Заголовки запроса
headers = {
    'Authorization': f'Basic {API_TOKEN}',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
}

# Функция для получения всех задач в проекте
def get_all_work_packages(project_id):
    url = f"{BASE_URL}/projects/{project_id}/work_packages"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()['_embedded']['elements']
    else:
        print(f"Ошибка при получении задач: {response.status_code} - {response.text}")
        return []

# Функция для удаления задачи
def delete_work_package(work_package_id):
    url = f"{BASE_URL}/work_packages/{work_package_id}"
    response = requests.delete(url, headers=headers)
    if response.status_code == 204:
        print(f"Задача {work_package_id} успешно удалена")
    else:
        print(f"Ошибка при удалении задачи {work_package_id}: {response.status_code} - {response.text}")

# Основной код
def delete_all_work_packages(project_id):
    while True:
        work_packages = get_all_work_packages(project_id)
        if not work_packages:
            break
        for wp in work_packages:
            delete_work_package(wp['id'])
    print("Все задачи удалены.")

if __name__ == "__main__":
    delete_all_work_packages(PROJECT_ID)
