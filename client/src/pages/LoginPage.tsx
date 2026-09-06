import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.mustChangePassword) {
        navigate('/change-password');
      } else if (loggedInUser.role === 'EMPLOYEE') {
        navigate('/payslips');
      } else if (loggedInUser.role === 'HR_PAYROLL_USER') {
        navigate('/payruns');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '50px', backgroundColor: '#e8e8e8', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '400px', backgroundColor: 'white', border: '2px solid #333', padding: '0' }}>
        
        <div style={{ backgroundColor: '#003366', color: 'white', padding: '10px', fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333' }}>
          TruPRM - Secure Login
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px', fontSize: '13px', color: '#333' }}>
            Please enter your system credentials to access the Human Resources and Payroll modules.
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ color: 'red', border: '1px solid red', padding: '8px', marginBottom: '15px', fontSize: '12px', backgroundColor: '#ffeeee' }}>
                Error: {error}
              </div>
            )}
            
            <table style={{ width: '100%', marginBottom: '15px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', width: '30%', fontSize: '13px', fontWeight: 'bold' }}>Email ID:</td>
                  <td style={{ padding: '8px 0' }}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{ width: '100%', border: '1px solid #999', padding: '4px', fontSize: '13px' }}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', fontSize: '13px', fontWeight: 'bold' }}>Password:</td>
                  <td style={{ padding: '8px 0' }}>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ width: '100%', border: '1px solid #999', padding: '4px', fontSize: '13px' }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px', textAlign: 'right' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: '#e0e0e0',
                  border: '1px outset #999',
                  padding: '5px 15px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: 'black'
                }}
              >
                {loading ? 'Authenticating...' : 'Login'}
              </button>
            </div>
          </form>
        </div>

      </div>
      
      <div style={{ marginTop: '20px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
        Unauthorized access is prohibited.<br/>
        &copy; 2026 TruPRM Government Systems. All Rights Reserved.
      </div>
    </div>
  );
}
