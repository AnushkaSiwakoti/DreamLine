import requests
import sys
import json
import base64
from datetime import datetime

class MakeItHappenAPITester:
    def __init__(self, base_url="https://goalflow-32.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    details += f", Error: {error_detail}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_signup(self):
        """Test user signup"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"test_{timestamp}@example.com"
        test_password = "TestPass123!"
        
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data={"email": test_email, "password": test_password}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_login(self):
        """Test user login with existing credentials"""
        # First create a user
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"login_test_{timestamp}@example.com"
        test_password = "TestPass123!"
        
        # Signup first
        signup_success, signup_response = self.run_test(
            "Login Test - Signup",
            "POST", 
            "auth/signup",
            200,
            data={"email": test_email, "password": test_password}
        )
        
        if not signup_success:
            return False
            
        # Now test login
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login", 
            200,
            data={"email": test_email, "password": test_password}
        )
        
        return success and 'token' in response

    def test_auth_me(self):
        """Test getting current user info"""
        if not self.token:
            self.log_test("Get Current User", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        return success and 'id' in response

    def test_goal_dump_text_only(self):
        """Test goal dump with text only"""
        if not self.token:
            self.log_test("Goal Dump (Text Only)", False, "No token available")
            return False
            
        goal_text = "I want to get in better shape, learn a new skill, and improve my career prospects. I'd like to travel more and build better relationships."
        
        success, response = self.run_test(
            "Goal Dump (Text Only)",
            "POST",
            "goals/dump",
            200,
            data={"text": goal_text, "images": []}
        )
        
        if success:
            self.goal_id = response.get('goal_id')
            self.plan_id = response.get('plan_id')
            return 'focus_areas' in response
        return False

    def test_goal_dump_with_image(self):
        """Test goal dump with base64 image"""
        if not self.token:
            self.log_test("Goal Dump (With Image)", False, "No token available")
            return False
            
        # Create a simple test image (1x1 PNG)
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg=="
        
        goal_text = "I want to achieve my fitness goals and travel to beautiful places."
        
        success, response = self.run_test(
            "Goal Dump (With Image)",
            "POST",
            "goals/dump",
            200,
            data={"text": goal_text, "images": [test_image_base64]}
        )
        
        return success and 'focus_areas' in response

    def test_get_current_plan(self):
        """Test getting current plan"""
        if not self.token:
            self.log_test("Get Current Plan", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Current Plan",
            "GET",
            "plans/current",
            200
        )
        
        return success

    def test_get_today_actions(self):
        """Test getting today's actions"""
        if not self.token:
            self.log_test("Get Today Actions", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Today Actions",
            "GET",
            "daily/today",
            200
        )
        
        return success and isinstance(response, list)

    def test_check_in_action(self):
        """Test checking in an action"""
        if not self.token:
            self.log_test("Check In Action", False, "No token available")
            return False
            
        # First get today's actions
        success, actions = self.run_test(
            "Get Actions for Check-in",
            "GET",
            "daily/today",
            200
        )
        
        if not success or not actions:
            self.log_test("Check In Action", False, "No actions available to check in")
            return False
            
        # Check in the first action
        action_id = actions[0]['id']
        success, response = self.run_test(
            "Check In Action",
            "POST",
            "daily/check-in",
            200,
            data={"action_id": action_id, "completed": True}
        )
        
        return success and response.get('success') == True

    def test_get_progress(self):
        """Test getting progress data"""
        if not self.token:
            self.log_test("Get Progress", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Progress",
            "GET",
            "progress",
            200
        )
        
        return success and 'completion_rate' in response

    def test_invalid_credentials(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@example.com", "password": "wrongpassword"}
        )
        
        return success  # Success means we got the expected 401

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access",
            "GET",
            "auth/me",
            401
        )
        
        # Restore token
        self.token = original_token
        return success  # Success means we got the expected 401

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Make It Happen API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        # Test authentication flow
        if not self.test_signup():
            print("❌ Signup failed - stopping tests")
            return False
            
        self.test_login()
        self.test_auth_me()
        
        # Test goal and plan functionality
        self.test_goal_dump_text_only()
        self.test_goal_dump_with_image()
        self.test_get_current_plan()
        
        # Test daily actions
        self.test_get_today_actions()
        self.test_check_in_action()
        
        # Test progress
        self.test_get_progress()
        
        # Test error cases
        self.test_invalid_credentials()
        self.test_unauthorized_access()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return False

def main():
    tester = MakeItHappenAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())