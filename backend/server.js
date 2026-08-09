const express=require("express");
const app=express();
app.use(express.json());
const PORT=3000;
app.get("/deliveries",(req,res)=>{
    res.json([
        { 
            id:1,
            name:"manvitha",
            status:pending,
        },
        {
            id:2,
           name:"varun",
            status:"pending",
        }
    ]);
});
app.listen(PORT,()=>{
    console.log(`server is running on http://localhost:${PORT}`);
});