For this challenge, you need to take 2 matrices as an input from the stdin , add them and print the resultant matrix to the stdout. 

Input Format
Two matrices to be taken as an input. 
For each matrix, on first line you need to tell that how many rows and columns your matrix need to have and these values should be separated by space. 
Then after that, each line will represent will represent each row and you need to enter numbers which each rows should have separated by a space. 

Constraints
1 <  (n,m) < 100
1 <  (p,q) < 100

Output Format
Print the resultant matrix to the stdout where each each line should represent 
Note : Please do not include space after the numbers which are in the last column as it will affect your submission and you will not get marks. 
each row and values in the row should be separated by a space.


dim = list(map(int, input().split()))
m = dim[0]
n = dim[1]


matrix1 = []

for i in range(m):
    matrix1.append(list(map(int, input().split())))

dim = list(map(int, input().split()))
m = dim[0]
n = dim[1]


matrix2 = []

for i in range(m):
    matrix2.append(list(map(int, input().split())))

matrix = []
for i in range(len(matrix1)):
    mat = []
    for j in range(len(matrix1[0])):
        mat.append(matrix1[i][j] + matrix2[i][j])
    matrix.append(mat)



for i in range(len(matrix)):
    if i == len(matrix1)-1:
         print(" ".join(str(x) for x in matrix[i]), end = "")
    else:
        print(" ".join(str(x) for x in matrix[i]))
