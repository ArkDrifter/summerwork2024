import requests
import base64
import sys
import time

# Конфигурация
BASE_URL = 'http://localhost:8085/api/v3'  # Обновите URL в соответствии с вашим сервером
PROJECT_ID = 'test' # ID проекта в OpenProject или его имя (например, "1" или "test")
API_KEY = 'Apikey'  # Ваш API ключ

# Генерация токена
API_TOKEN = base64.b64encode(f'apikey:{API_KEY}'.encode()).decode()

# Заголовки запроса
headers = {
    'Authorization': f'Basic {API_TOKEN}',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
}

def test_connection():
    """Проверка подключения к серверу"""
    try:
        response = requests.get(f"{BASE_URL}/projects/{PROJECT_ID}", headers=headers)
        if response.status_code == 200:
            print(f"✓ Успешное подключение к проекту {PROJECT_ID}")
            return True
        elif response.status_code == 403:
            print("✗ Ошибка доступа: Недостаточно прав")
            return False
        elif response.status_code == 404:
            print("✗ Проект не найден")
            return False
        else:
            print(f"✗ Ошибка подключения: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Ошибка сети: {e}")
        return False

def get_all_work_packages(project_id):
    """Получение всех задач в проекте"""
    try:
        url = f"{BASE_URL}/projects/{project_id}/work_packages"
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Вызовет исключение при ошибке
        data = response.json()
        if '_embedded' in data and 'elements' in data['_embedded']:
            packages = data['_embedded']['elements']
            print(f"Найдено задач: {len(packages)}")
            return packages
        else:
            print("Структура ответа не содержит задач")
            return []
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при получении задач: {e}")
        return []
    except ValueError as e:
        print(f"Ошибка при разборе JSON: {e}")
        return []

def delete_work_package(work_package_id):
    """Удаление задачи с повторными попытками"""
    max_retries = 3
    retry_delay = 1  # секунды

    for attempt in range(max_retries):
        try:
            url = f"{BASE_URL}/work_packages/{work_package_id}"
            response = requests.delete(url, headers=headers)
            
            if response.status_code == 204:
                print(f"✓ Задача {work_package_id} успешно удалена")
                return True
            elif response.status_code == 403:
                print(f"✗ Нет прав на удаление задачи {work_package_id}")
                return False
            elif response.status_code == 404:
                print(f"✗ Задача {work_package_id} не найдена")
                return False
            else:
                print(f"✗ Ошибка при удалении задачи {work_package_id}: {response.status_code}")
                
                if attempt < max_retries - 1:
                    print(f"Повторная попытка через {retry_delay} сек...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Увеличиваем задержку при каждой попытке
                    continue
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"Ошибка сети при удалении задачи {work_package_id}: {e}")
            if attempt < max_retries - 1:
                print(f"Повторная попытка через {retry_delay} сек...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            return False

def delete_all_work_packages(project_id):
    """Удаление всех задач с подтверждением"""
    if not test_connection():
        print("Прерывание: Проблема с подключением к серверу")
        return

    work_packages = get_all_work_packages(project_id)
    if not work_packages:
        print("Нет задач для удаления")
        return

    print(f"\nБудет удалено {len(work_packages)} задач")
    confirmation = input("Продолжить? (y/n): ")
    if confirmation.lower() != 'y':
        print("Операция отменена")
        return

    success_count = 0
    fail_count = 0

    for wp in work_packages:
        if delete_work_package(wp['id']):
            success_count += 1
        else:
            fail_count += 1
        time.sleep(0.5)  # Небольшая задержка между удалениями

    print(f"\nРезультаты:")
    print(f"✓ Успешно удалено: {success_count}")
    print(f"✗ Ошибок: {fail_count}")

if __name__ == "__main__":
    print("OpenProject - Удаление задач")
    print("=" * 30)
    delete_all_work_packages(PROJECT_ID)
