// Validation Schemas for API Endpoints
import Joi from "joi";

// User validation schemas
export const userSchema = Joi.object({
  username: Joi.string().min(3).max(30).required().messages({
    "string.base": "Username deve essere una stringa",
    "string.empty": "Username è richiesto",
    "string.min": "Username deve avere almeno 3 caratteri",
    "string.max": "Username non può superare 30 caratteri",
    "any.required": "Username è richiesto"
  }),
  email: Joi.string().email().required().messages({
    "string.base": "Email deve essere una stringa",
    "string.email": "Email non è valida",
    "string.empty": "Email è richiesta",
    "any.required": "Email è richiesta"
  }),
  password: Joi.string().min(6).max(100).required().messages({
    "string.base": "Password deve essere una stringa",
    "string.empty": "Password è richiesta",
    "string.min": "Password deve avere almeno 6 caratteri",
    "string.max": "Password non può superare 100 caratteri",
    "any.required": "Password è richiesta"
  }),
  role: Joi.string().valid("student", "teacher").default("student").messages({
    "string.base": "Role deve essere una stringa",
    "any.only": "Role deve essere 'student' o 'teacher'",
    "any.required": "Role è richiesto"
  }),
  learningStyle: Joi.string().valid("visual", "auditory", "kinesthetic", "reading").default("visual").messages({
    "string.base": "Learning style deve essere una stringa",
    "any.only": "Learning style deve essere uno tra: visual, auditory, kinesthetic, reading",
    "any.required": "Learning style è richiesto"
  })
});

// Document validation schemas
export const documentSchema = Joi.object({
  title: Joi.string().min(1).max(200).required().messages({
    "string.base": "Titolo deve essere una stringa",
    "string.empty": "Titolo è richiesto",
    "string.min": "Titolo deve avere almeno 1 carattere",
    "string.max": "Titolo non può superare 200 caratteri",
    "any.required": "Titolo è richiesto"
  }),
  subjectId: Joi.number().integer().positive().required().messages({
    "number.base": "ID materia deve essere un numero",
    "number.integer": "ID materia deve essere un intero",
    "number.positive": "ID materia deve essere positivo",
    "any.required": "ID materia è richiesto"
  }),
  uploadedBy: Joi.number().integer().positive().required().messages({
    "number.base": "ID utente deve essere un numero",
    "number.integer": "ID utente deve essere un intero",
    "number.positive": "ID utente deve essere positivo",
    "any.required": "ID utente è richiesto"
  }),
  content: Joi.string().min(10).required().messages({
    "string.base": "Contenuto deve essere una stringa",
    "string.empty": "Contenuto è richiesto",
    "string.min": "Contenuto deve avere almeno 10 caratteri",
    "any.required": "Contenuto è richiesto"
  })
});

// Question validation schemas
export const questionSchema = Joi.object({
  userId: Joi.number().integer().positive().required().messages({
    "number.base": "ID utente deve essere un numero",
    "number.integer": "ID utente deve essere un intero",
    "number.positive": "ID utente deve essere positivo",
    "any.required": "ID utente è richiesto"
  }),
  subjectId: Joi.number().integer().positive().required().messages({
    "number.base": "ID materia deve essere un numero",
    "number.integer": "ID materia deve essere un intero",
    "number.positive": "ID materia deve essere positivo",
    "any.required": "ID materia è richiesto"
  }),
  question: Joi.string().min(10).max(500).required().messages({
    "string.base": "Domanda deve essere una stringa",
    "string.empty": "Domanda è richiesta",
    "string.min": "Domanda deve avere almeno 10 caratteri",
    "string.max": "Domanda non può superare 500 caratteri",
    "any.required": "Domanda è richiesta"
  }),
  documentId: Joi.number().integer().positive().allow(null).allow("").optional(),
  learningStyle: Joi.string().valid("visual", "auditory", "kinesthetic", "reading").default("visual").messages({
    "string.base": "Learning style deve essere una stringa",
    "any.only": "Learning style deve essere uno tra: visual, auditory, kinesthetic, reading",
    "any.required": "Learning style è richiesto"
  })
});

// Answer validation schemas
export const answerSchema = Joi.object({
  qualityScore: Joi.number().integer().min(1).max(5).required().messages({
    "number.base": "Qualità punteggio deve essere un numero",
    "number.integer": "Qualità punteggio deve essere un intero",
    "number.min": "Qualità punteggio deve essere almeno 1",
    "number.max": "Qualità punteggio non può superare 5",
    "any.required": "Qualità punteggio è richiesto"
  }),
  creditsEarned: Joi.number().integer().min(0).max(100).default(10).messages({
    "number.base": "Crediti guadagnati deve essere un numero",
    "number.integer": "Crediti guadagnati deve essere un intero",
    "number.min": "Crediti guadagnati deve essere almeno 0",
    "number.max": "Crediti guadagnati non può superare 100",
    "any.required": "Crediti guadagnati è richiesto"
  })
});

// Pagination validation schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Pagina deve essere un numero",
    "number.integer": "Pagina deve essere un intero",
    "number.min": "Pagina deve essere almeno 1",
    "any.required": "Pagina è richiesta"
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limite deve essere un numero",
    "number.integer": "Limite deve essere un intero",
    "number.min": "Limite deve essere almeno 1",
    "number.max": "Limite non può superare 100",
    "any.required": "Limite è richiesto"
  })
});

// Middleware function for validation
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({ 
        error: "Validazione fallita", 
        details: errors 
      });
    }
    next();
  };
};