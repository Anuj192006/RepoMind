export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  try {
    const user = await db.user.findUnique({ 
      where: { email } 
    });

    if (!user || !(await compare(password, user.password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    return res.json({ 
      success: true, 
      token 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};
