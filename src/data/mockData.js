export const MOCK_REPO = [
  { id: '1', name: 'auth', type: 'folder', children: [
    { id: '2', name: 'login.ts', type: 'file' },
  ]},
  { id: '3', name: 'middleware', type: 'folder', children: [
    { id: '4', name: 'auth.ts', type: 'file' },
  ]},
  { id: '5', name: 'utils', type: 'folder', children: [
    { id: '6', name: 'retry.ts', type: 'file' },
  ]},
  { id: '7', name: 'payment', type: 'folder', children: [
    { id: '8', name: 'retryHandler.js', type: 'file' },
  ]},
  { id: '9', name: 'api', type: 'folder', children: [
    { id: '10', name: 'validation.ts', type: 'file' },
  ]},
  { id: '11', name: 'algorithms', type: 'folder', children: [
    { id: '12', name: 'binarySearch.cpp', type: 'file' },
  ]},
  { id: '13', name: 'dp', type: 'folder', children: [
    { id: '14', name: 'knapsack.cpp', type: 'file' },
  ]},
];

export const MOCK_SEARCH_RESULTS = [
  {
    id: 'res-1',
    path: 'src/auth/login.ts',
    score: 0.98,
    relevance: 'High',
    explanation: 'Contains core authentication logic using JWT and session management.',
    code: `export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await db.user.findUnique({ where: { email } });
  
  if (!user || !compare(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = signToken(user.id);
  return res.json({ token });
};`,
    language: 'typescript'
  },
  {
    id: 'res-2',
    path: 'src/middleware/auth.js',
    score: 0.92,
    relevance: 'High',
    explanation: 'Middleware that verifies the JWT token for incoming requests.',
    code: `const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('Unauthorized');

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send('Invalid token');
  }
};`,
    language: 'javascript'
  },
  {
    id: 'res-3',
    path: 'src/api/validation.js',
    score: 0.75,
    relevance: 'Medium',
    explanation: 'Handles validation schemas for user inputs, including login fields.',
    code: `const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const validateLogin = (data) => loginSchema.parse(data);`,
    language: 'javascript'
  }
];

export const FEATURES = [
  {
    title: 'Semantic Retrieval',
    description: 'Go beyond keyword matching. Our AI understands the intent and context of your search queries.',
    icon: 'Search'
  },
  {
    title: 'Context-Aware Matching',
    description: 'Understands relationships between files, classes, and functions to provide more accurate results.',
    icon: 'Cpu'
  },
  {
    title: 'Natural Language Search',
    description: 'Ask questions like you would to a colleague. "Where do we handle payment retries?"',
    icon: 'MessageSquare'
  },
  {
    title: 'Repository Intelligence',
    description: 'Get an instant overview of any codebase, no matter how large or complex.',
    icon: 'Brain'
  }
];
